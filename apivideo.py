from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import numpy as np
import base64
import tempfile
import os

app = Flask(__name__)
CORS(app)

# Modelleri yükle
lane_model = YOLO("best_lane.pt")
vehicle_model = YOLO("best_vechile.pt")

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

            # 1. Decode gelen video
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

                # Lane Segmentasyonu
                lane_result = lane_model(rgb)[0]
                if lane_result.masks is not None:
                    for mask in lane_result.masks.data:
                        mask = mask.cpu().numpy().astype(np.uint8) * 255
                        mask = cv2.resize(mask, (frame.shape[1], frame.shape[0]))
                        blue_mask = np.zeros_like(frame)
                        blue_mask[:, :, 0] = mask
                        frame = cv2.addWeighted(frame, 1, blue_mask, 0.5, 0)

                # Vehicle Detection
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

            # Encode processed video as base64
            processed_base64 = encode_video(output_path)

        return jsonify({
            "status": "success",
            "frames_processed": frame_count,
            "processed_video": processed_base64
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500



if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)