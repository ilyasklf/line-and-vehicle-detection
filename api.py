from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import numpy as np
import base64
from PIL import Image
import io

app = Flask(__name__)
CORS(app)

# Modelleri yükle
lane_model = YOLO("best_lane.pt")
vehicle_model = YOLO("best_vechile.pt")

def read_image(file):
    img_bytes = file.read()
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

def encode_image(img):
    _, buffer = cv2.imencode('.png', img)
    return base64.b64encode(buffer).decode('utf-8')

@app.route("/predict-image", methods=["POST"])
def predict_image():
    if 'image' not in request.files:
        return jsonify({"error": "Görsel bulunamadı."})

    file = request.files['image']
    image = read_image(file)
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    # Segmentasyon (lane)
    seg_result = lane_model(rgb)[0]
    combined = image.copy()
    if seg_result.masks is not None:
        for mask in seg_result.masks.data:
            mask = mask.cpu().numpy().astype(np.uint8) * 255
            mask = cv2.resize(mask, (image.shape[1], image.shape[0]))
            blue_mask = np.zeros_like(image)
            blue_mask[:, :, 0] = mask
            combined = cv2.addWeighted(combined, 1, blue_mask, 0.5, 0)

    # Araç tespiti
    vehicle_result = vehicle_model(rgb)[0]
    for box in vehicle_result.boxes:
        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
        label = vehicle_model.names[int(box.cls)]
        conf = float(box.conf)
        cv2.rectangle(combined, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(combined, f"{label} {conf:.2f}", (x1, y1 - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    # Encode & return
    encoded = encode_image(combined)
    return jsonify({"image": encoded})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
