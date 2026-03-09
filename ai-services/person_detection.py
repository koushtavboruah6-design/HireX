"""
person_detection.py — Multi-Person & Object Detection

Strategy (in order of reliability):
  1. YOLOv8n for person + phone + objects (best)
  2. OpenCV DNN with MobileNet SSD (medium — no extra download)
  3. OpenCV Haar cascades for face count only (always works)

Key fix: Face count was previously unreliable because YOLO counts
"person" not "face" — a person behind someone shows 1 YOLO person
but the face might be hidden. Now uses cascade as authoritative face counter
and YOLO as person/object counter.
"""

import os
import numpy as np
import cv2
from loguru import logger

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    logger.warning("ultralytics not installed — using OpenCV for detection")

CONF_THRESHOLD = 0.40
PERSON_CLASS   = 0
PHONE_CLASS    = 67
BOOK_CLASS     = 73

SUSPICIOUS_CLASSES = {PHONE_CLASS: "phone", BOOK_CLASS: "book", 65: "remote"}


class PersonDetector:
    def __init__(self):
        self._ready       = False
        self._yolo        = None
        self._face_casc   = None
        self._profile_casc= None
        self._use_yolo    = False
        self._init_models()

    def _init_models(self):
        # Always load OpenCV cascades first (guaranteed to work)
        try:
            self._face_casc = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            self._profile_casc = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_profileface.xml')
            self._ready = True
            logger.info("PersonDetector: OpenCV cascades loaded ✓")
        except Exception as e:
            logger.error(f"OpenCV cascade load failed: {e}")

        # Try to load YOLO on top
        if YOLO_AVAILABLE:
            model_path = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
            try:
                self._yolo = YOLO(model_path)
                self._use_yolo = True
                self._ready = True
                logger.info(f"PersonDetector: YOLOv8 loaded from {model_path} ✓")
            except Exception as e:
                logger.warning(f"YOLO load failed ({e}) — using OpenCV only")

    def is_ready(self): return self._ready

    def analyze(self, frame: np.ndarray) -> dict:
        """
        Returns:
            face_count:         int  — number of faces detected
            person_count:       int  — number of full people detected
            phone_detected:     bool
            phone_confidence:   float
            suspicious_objects: list
            confidence:         float
            detections:         list[dict]  — bounding boxes
        """
        result = {
            "face_count":        0,
            "person_count":      0,
            "phone_detected":    False,
            "phone_confidence":  0.0,
            "suspicious_objects":[],
            "confidence":        0.0,
            "detections":        [],
        }

        # ── Step 1: count faces with OpenCV (always run this) ──────────────────
        face_result = self._detect_faces_opencv(frame)
        result["face_count"] = face_result["face_count"]
        result["confidence"] = face_result["confidence"]

        # ── Step 2: run YOLO for persons + objects ────────────────────────────
        if self._use_yolo and self._yolo is not None:
            try:
                yolo_result = self._run_yolo(frame)
                # Use YOLO person count but keep OpenCV face count (more reliable for faces)
                result["person_count"]     = yolo_result["person_count"]
                result["phone_detected"]   = yolo_result["phone_detected"]
                result["phone_confidence"] = yolo_result["phone_confidence"]
                result["suspicious_objects"] = yolo_result["suspicious_objects"]
                result["detections"]       = yolo_result["detections"]
                # Take max confidence
                result["confidence"] = max(result["confidence"], yolo_result["confidence"])
                # If YOLO sees more persons than faces (e.g. back of head), trust YOLO for person count
                if yolo_result["person_count"] > result["face_count"]:
                    result["face_count"] = yolo_result["person_count"]
            except Exception as e:
                logger.warning(f"YOLO inference failed: {e}")
        else:
            # Without YOLO, person count == face count
            result["person_count"] = result["face_count"]

        return result

    def _detect_faces_opencv(self, frame: np.ndarray) -> dict:
        """
        Detect faces using Haar cascades.
        Uses both frontal and profile cascades to catch turned heads.
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        h, w = gray.shape

        # Frontal face detection
        frontal = []
        if self._face_casc is not None and not self._face_casc.empty():
            frontal = list(self._face_casc.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=8,     # was 4 — higher = fewer false positives
                minSize=(int(w*0.10), int(h*0.10)),  # face must be at least 10% of frame
                flags=cv2.CASCADE_SCALE_IMAGE,
            ))

        # Profile face detection (catches side views)
        profile = []
        if self._profile_casc is not None and not self._profile_casc.empty():
            profile_l = list(self._profile_casc.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=8,
                minSize=(int(w*0.10), int(h*0.10))
            ))
            # Flip frame and detect again for right-side profiles
            profile_r = list(self._profile_casc.detectMultiScale(
                cv2.flip(gray, 1), scaleFactor=1.1, minNeighbors=8,
                minSize=(int(w*0.10), int(h*0.10))
            ))
            profile = profile_l + profile_r

        # Merge and deduplicate using IOU
        all_faces = frontal + profile
        unique_faces = self._deduplicate_rects(all_faces, iou_threshold=0.2)
        face_count = len(unique_faces)

        confidence = min(0.9, 0.5 + face_count * 0.15) if face_count > 0 else 0.0

        return {"face_count": face_count, "confidence": confidence, "rects": unique_faces}

    def _run_yolo(self, frame: np.ndarray) -> dict:
        """Run YOLOv8 inference."""
        results = self._yolo(frame, verbose=False, conf=CONF_THRESHOLD)

        person_count = 0
        phone_conf   = 0.0
        phone_found  = False
        suspicious   = []
        detections   = []
        max_conf     = 0.0

        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf   = float(box.conf[0])
                xyxy   = box.xyxy[0].tolist()
                name   = r.names.get(cls_id, str(cls_id))

                detections.append({
                    "class_id": cls_id, "class_name": name,
                    "confidence": round(conf, 3),
                    "bbox": [round(x, 1) for x in xyxy],
                })
                max_conf = max(max_conf, conf)

                if cls_id == PERSON_CLASS:
                    person_count += 1
                elif cls_id == PHONE_CLASS:
                    phone_found = True
                    phone_conf  = max(phone_conf, conf)
                    suspicious.append({"type": "phone", "confidence": conf})
                elif cls_id in SUSPICIOUS_CLASSES:
                    suspicious.append({"type": SUSPICIOUS_CLASSES[cls_id], "confidence": conf})

        return {
            "person_count":      person_count,
            "phone_detected":    phone_found,
            "phone_confidence":  round(phone_conf, 3),
            "suspicious_objects":suspicious,
            "confidence":        round(max_conf, 3),
            "detections":        detections,
        }

    def _deduplicate_rects(self, rects, iou_threshold=0.3):
        """Remove duplicate face detections using IOU overlap."""
        if len(rects) == 0:
            return []
        unique = []
        for r in rects:
            dominated = False
            for u in unique:
                if self._iou(r, u) > iou_threshold:
                    dominated = True
                    break
            if not dominated:
                unique.append(r)
        return unique

    def _iou(self, a, b):
        ax, ay, aw, ah = a
        bx, by, bw, bh = b
        ix = max(ax, bx); iy = max(ay, by)
        ex = min(ax+aw, bx+bw); ey = min(ay+ah, by+bh)
        if ex < ix or ey < iy:
            return 0.0
        inter = (ex-ix) * (ey-iy)
        union = aw*ah + bw*bh - inter
        return inter / max(union, 1)

    def draw_debug(self, frame: np.ndarray, result: dict) -> np.ndarray:
        d = frame.copy()
        for det in result.get("detections", []):
            x1,y1,x2,y2 = [int(v) for v in det["bbox"]]
            color = (0,255,0) if det["class_name"]=="person" else (0,0,255)
            cv2.rectangle(d, (x1,y1), (x2,y2), color, 2)
            cv2.putText(d, f"{det['class_name']} {det['confidence']:.2f}",
                        (x1, y1-6), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)
        cv2.putText(d, f"Faces:{result['face_count']} Persons:{result['person_count']}",
                    (10,30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,255), 2)
        return d
