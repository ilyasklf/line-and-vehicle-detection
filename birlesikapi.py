from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import numpy as np
import base64
from PIL import Image
import io
import tempfile
import os

app = Flask(__name__)
CORS(app)

# MODELLER
lane_model = YOLO("best_lane.pt")
vehicle_model = YOLO("best_vechile.pt")

############################
# --- FOTOĞRAF YORUMU --- #
############################

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
        return jsonify({"error": "Görsel bulunamadı."}), 400

    file = request.files['image']
    image = read_image(file)
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    # Segmentasyon
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

    encoded = encode_image(combined)
    return jsonify({"image": encoded})


#########################
# --- VİDEO YORUMU --- #
#########################

def decode_video(base64_str, out_path):
    video_bytes = base64.b64decode(base64_str)
    with open(out_path, 'wb') as f:
        f.write(video_bytes)

def encode_video(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')

@app.route("/vehicle-video", methods=["POST"])
def process_video():
    data = request.get_json()
    if 'video' not in data:
        return jsonify({"error": "No video data received"}), 400

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            input_path = os.path.join(tmpdir, "input.mp4")
            output_path = os.path.join(tmpdir, "output.mp4")

            decode_video(data['video'], input_path)

            cap = cv2.VideoCapture(input_path)
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS)

            out = cv2.VideoWriter(output_path, cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))

            frame_count = 0
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

                # Lane segmentasyonu
                lane_result = lane_model(rgb)[0]
                if lane_result.masks is not None:
                    for mask in lane_result.masks.data:
                        mask = mask.cpu().numpy().astype(np.uint8) * 255
                        mask = cv2.resize(mask, (frame.shape[1], frame.shape[0]))
                        blue_mask = np.zeros_like(frame)
                        blue_mask[:, :, 0] = mask
                        frame = cv2.addWeighted(frame, 1, blue_mask, 0.5, 0)

                # Vehicle detection
                vehicle_result = vehicle_model(rgb)[0]
                for box in vehicle_result.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                    label = vehicle_model.names[int(box.cls)]
                    conf = float(box.conf)
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(frame, f"{label} {conf:.2f}", (x1, y1 - 5),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

                out.write(frame)
                frame_count += 1

            cap.release()
            out.release()

            encoded = encode_video(output_path)

        return jsonify({
            "status": "success",
            "frames_processed": frame_count,
            "processed_video": encoded
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


#########################

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
