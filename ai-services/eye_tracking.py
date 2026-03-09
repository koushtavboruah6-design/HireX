"""
eye_tracking.py — Robust Eye Gaze Tracking

Strategy (in order of reliability):
  1. MediaPipe iris landmarks (best — needs refine_landmarks=True)
  2. MediaPipe face mesh eye corners only (no iris, uses pupil estimation)
  3. OpenCV eye + pupil detection (pure fallback, no MediaPipe)

Key fixes from v1/v2:
  - Right eye x-axis inversion (was flipped)
  - Sustained-gaze required before flagging (N frames)
  - Per-direction cooldown (no spam)
  - Baseline calibration per session
  - Threshold tuned to 0.45 (was 0.35 — too sensitive)
  - Fallback chain so feature works even without MediaPipe
"""

import os, math, time
import numpy as np
import cv2
from loguru import logger
from collections import deque

try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    logger.warning("MediaPipe not available — using OpenCV fallback for gaze")

# ── MediaPipe landmark indices ─────────────────────────────────────────────────
# Iris (require refine_landmarks=True, indices 468-477)
LEFT_IRIS        = [474, 475, 476, 477]
RIGHT_IRIS       = [469, 470, 471, 472]
# Eye corners (standard 468-point mesh)
LEFT_EYE_OUTER   = 33
LEFT_EYE_INNER   = 133
RIGHT_EYE_INNER  = 362
RIGHT_EYE_OUTER  = 263
LEFT_EYE_TOP     = 159
LEFT_EYE_BOTTOM  = 145
RIGHT_EYE_TOP    = 386
RIGHT_EYE_BOTTOM = 374
# Nose tip for head orientation reference
NOSE_TIP         = 1
CHIN             = 152
LEFT_CHEEK       = 234
RIGHT_CHEEK      = 454

# ── Config ─────────────────────────────────────────────────────────────────────
H_THRESH            = float(os.getenv("GAZE_AWAY_THRESHOLD",    "0.45"))
V_THRESH            = float(os.getenv("GAZE_VERTICAL_THRESHOLD","0.40"))
SUSTAINED_FRAMES    = int(os.getenv("GAZE_SUSTAINED_FRAMES",    "3"))
COOLDOWN_S          = float(os.getenv("GAZE_COOLDOWN_SECONDS",  "8.0"))
MIN_CONFIDENCE      = 0.50
CALIBRATION_N       = 12   # frames to collect for baseline


class EyeGazeTracker:
    def __init__(self):
        self._ready           = False
        self._mesh_iris       = None   # MediaPipe with refine_landmarks=True
        self._mesh_basic      = None   # MediaPipe without iris (fallback)
        self._recent          = deque(maxlen=SUSTAINED_FRAMES + 3)
        self._cooldown        = {}     # direction -> last alert time
        self._cal_buf         = []
        self._cal_x           = 0.0
        self._cal_y           = 0.0
        self._calibrated      = False
        self._method          = "none"
        self._init_models()

    def _init_models(self):
        if MEDIAPIPE_AVAILABLE:
            try:
                fm = mp.solutions.face_mesh
                # Primary: with iris
                self._mesh_iris = fm.FaceMesh(
                    static_image_mode=True, max_num_faces=1,
                    refine_landmarks=True,
                    min_detection_confidence=MIN_CONFIDENCE,
                    min_tracking_confidence=MIN_CONFIDENCE,
                )
                self._method = "mediapipe_iris"
                self._ready = True
                logger.info("EyeGazeTracker: MediaPipe iris mode ✓")
            except Exception as e:
                logger.warning(f"MediaPipe iris init failed: {e}")

            if not self._ready:
                try:
                    fm = mp.solutions.face_mesh
                    self._mesh_basic = fm.FaceMesh(
                        static_image_mode=True, max_num_faces=1,
                        refine_landmarks=False,
                        min_detection_confidence=MIN_CONFIDENCE,
                    )
                    self._method = "mediapipe_basic"
                    self._ready = True
                    logger.info("EyeGazeTracker: MediaPipe basic (no iris) mode ✓")
                except Exception as e:
                    logger.warning(f"MediaPipe basic init failed: {e}")

        if not self._ready:
            # Pure OpenCV fallback always available
            self._method = "opencv"
            self._ready = True
            logger.info("EyeGazeTracker: OpenCV fallback mode ✓")

    def is_ready(self): return self._ready

    # ── Public API ─────────────────────────────────────────────────────────────
    def analyze(self, frame: np.ndarray) -> dict:
        """
        Analyze frame and return gaze direction.
        Tries MediaPipe iris → MediaPipe basic → OpenCV in order.
        """
        result = None

        # Method 1: MediaPipe with iris landmarks
        if self._mesh_iris is not None:
            result = self._analyze_mediapipe_iris(frame)

        # Method 2: MediaPipe face mesh (no iris) — use eye corner midpoints
        if (result is None or result["confidence"] < 0.3) and self._mesh_basic is not None:
            result = self._analyze_mediapipe_basic(frame)

        # Method 3: Pure OpenCV
        if result is None or result["confidence"] < 0.3:
            result = self._analyze_opencv(frame)

        if result is None:
            return self._null()

        # Apply calibration baseline correction
        gaze_x = max(-1.0, min(1.0, result["raw_x"] - self._cal_x))
        gaze_y = max(-1.0, min(1.0, result["raw_y"] - self._cal_y))

        # Calibration collection
        if not self._calibrated and result["confidence"] > 0.4:
            if abs(result["raw_x"]) < 0.35 and abs(result["raw_y"]) < 0.35:
                self._cal_buf.append((result["raw_x"], result["raw_y"]))
            if len(self._cal_buf) >= CALIBRATION_N:
                self._cal_x = float(np.mean([p[0] for p in self._cal_buf]))
                self._cal_y = float(np.mean([p[1] for p in self._cal_buf]))
                self._calibrated = True
                logger.info(f"Gaze calibrated via {self._method}: x={self._cal_x:.3f} y={self._cal_y:.3f}")

        direction = self._classify(gaze_x, gaze_y)
        self._recent.append(direction)

        # Sustained + cooldown check
        flagged = False
        if direction not in ("center", None) and result["confidence"] > 0.3:
            last_n = list(self._recent)[-SUSTAINED_FRAMES:]
            sustained = (len(last_n) == SUSTAINED_FRAMES and all(d == direction for d in last_n))
            if sustained and (time.time() - self._cooldown.get(direction, 0)) >= COOLDOWN_S:
                flagged = True
                self._cooldown[direction] = time.time()
                logger.debug(f"Gaze flagged: {direction} (method={self._method})")

        return {
            "direction":  direction,
            "gaze_x":     round(gaze_x, 4),
            "gaze_y":     round(gaze_y, 4),
            "confidence": round(result["confidence"], 3),
            "flagged":    flagged,
            "method":     self._method,
            "raw":        {"raw_x": result["raw_x"], "raw_y": result["raw_y"], "calibrated": self._calibrated},
        }

    # ── Method 1: MediaPipe iris ────────────────────────────────────────────────
    def _analyze_mediapipe_iris(self, frame: np.ndarray) -> dict | None:
        try:
            h, w = frame.shape[:2]
            res = self._mesh_iris.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            if not res.multi_face_landmarks:
                return None
            lm = res.multi_face_landmarks[0].landmark
            if len(lm) < 478:
                logger.warning("MediaPipe returned < 478 landmarks — iris not available")
                return None

            lg = self._iris_gaze(lm, LEFT_IRIS,  LEFT_EYE_OUTER,  LEFT_EYE_INNER,  LEFT_EYE_TOP,  LEFT_EYE_BOTTOM,  w, h, flip_x=False)
            rg = self._iris_gaze(lm, RIGHT_IRIS, RIGHT_EYE_INNER, RIGHT_EYE_OUTER, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM, w, h, flip_x=True)

            lc, rc = lg["conf"], rg["conf"]
            total = lc + rc
            if total < 0.01: return None

            return {
                "raw_x":      (lg["x"] * lc + rg["x"] * rc) / total,
                "raw_y":      (lg["y"] * lc + rg["y"] * rc) / total,
                "confidence": min(1.0, (lc + rc) / 2.0),
            }
        except Exception as e:
            logger.error(f"_analyze_mediapipe_iris: {e}")
            return None

    def _iris_gaze(self, lm, iris_ids, outer_id, inner_id, top_id, bot_id, w, h, flip_x):
        try:
            iris = np.array([(lm[i].x * w, lm[i].y * h) for i in iris_ids])
            icx  = float(np.mean(iris[:, 0]))
            icy  = float(np.mean(iris[:, 1]))

            outer = (lm[outer_id].x * w, lm[outer_id].y * h)
            inner = (lm[inner_id].x * w, lm[inner_id].y * h)
            top   = (lm[top_id].x   * w, lm[top_id].y   * h)
            bot   = (lm[bot_id].x   * w, lm[bot_id].y   * h)

            ew = math.dist(outer, inner)
            eh = math.dist(top, bot)
            if ew < 2 or eh < 0.5:
                return {"x": 0.0, "y": 0.0, "conf": 0.0}

            cx = (outer[0] + inner[0]) / 2.0
            cy = (top[1]   + bot[1])   / 2.0

            rx = (icx - cx) / (ew * 0.5)
            ry = (icy - cy) / (eh * 0.5)

            if flip_x:
                rx = -rx  # right eye x-axis inversion

            spread = float(np.std(iris))
            conf   = min(1.0, max(0.0, 1.0 - spread / 10.0))

            return {"x": max(-1.0, min(1.0, rx)), "y": max(-1.0, min(1.0, ry)), "conf": conf}
        except:
            return {"x": 0.0, "y": 0.0, "conf": 0.0}

    # ── Method 2: MediaPipe basic (no iris) ─────────────────────────────────────
    def _analyze_mediapipe_basic(self, frame: np.ndarray) -> dict | None:
        """
        When iris landmarks aren't available, estimate gaze from head pose.
        If the nose tip moves left/right relative to cheeks, person is turning.
        """
        try:
            h, w = frame.shape[:2]
            mesh = self._mesh_basic or self._mesh_iris
            if mesh is None: return None

            res = mesh.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            if not res.multi_face_landmarks: return None
            lm = res.multi_face_landmarks[0].landmark

            nose_x   = lm[NOSE_TIP].x
            left_x   = lm[LEFT_CHEEK].x
            right_x  = lm[RIGHT_CHEEK].x
            face_w   = right_x - left_x
            if face_w < 0.01: return None

            # How centered is the nose within the face?
            # 0.5 = perfectly centered, <0.5 = face turned right, >0.5 = turned left
            nose_ratio = (nose_x - left_x) / face_w
            # Map to -1..+1 gaze estimate (0.5 center = 0.0)
            raw_x = (nose_ratio - 0.5) * 3.0   # scale so ±0.17 → ±0.5
            raw_x = max(-1.0, min(1.0, raw_x))

            # Vertical: nose vs eye level
            eye_y    = (lm[LEFT_EYE_TOP].y + lm[RIGHT_EYE_TOP].y) / 2
            chin_y   = lm[CHIN].y
            nose_y   = lm[NOSE_TIP].y
            face_h   = chin_y - eye_y
            if face_h < 0.01: return None
            raw_y = ((nose_y - eye_y) / face_h - 0.4) * 2.5
            raw_y = max(-1.0, min(1.0, raw_y))

            return {"raw_x": raw_x, "raw_y": raw_y, "confidence": 0.6}
        except Exception as e:
            logger.error(f"_analyze_mediapipe_basic: {e}")
            return None

    # ── Method 3: Pure OpenCV ───────────────────────────────────────────────────
    def _analyze_opencv(self, frame: np.ndarray) -> dict | None:
        """
        Detect eyes with Haar cascade, then find pupil within each eye ROI.
        Works without MediaPipe or YOLO.
        """
        try:
            h, w = frame.shape[:2]
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.equalizeHist(gray)

            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            eye_cascade  = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_eye.xml')

            faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(60, 60))
            if len(faces) == 0:
                return None

            fx, fy, fw, fh = max(faces, key=lambda r: r[2]*r[3])
            face_gray = gray[fy:fy+fh, fx:fx+fw]

            eyes = eye_cascade.detectMultiScale(face_gray, 1.1, 5, minSize=(20, 20))
            if len(eyes) < 2:
                # Even with one eye, estimate
                if len(eyes) == 0:
                    return None
                eyes = eyes[:1]

            offsets_x = []
            offsets_y = []
            for (ex, ey, ew, eh) in eyes[:2]:
                eye_roi = face_gray[ey:ey+eh, ex:ex+ew]
                # Find darkest region (pupil)
                blurred = cv2.GaussianBlur(eye_roi, (7, 7), 0)
                _, _, _, min_loc = cv2.minMaxLoc(blurred)
                pupil_x, pupil_y = min_loc

                # Normalize: 0=left, 1=right
                norm_x = pupil_x / max(ew, 1)
                norm_y = pupil_y / max(eh, 1)

                # Convert to -1..+1 offset from center
                off_x = (norm_x - 0.5) * 2.0
                off_y = (norm_y - 0.5) * 2.0
                offsets_x.append(off_x)
                offsets_y.append(off_y)

            raw_x = float(np.mean(offsets_x))
            raw_y = float(np.mean(offsets_y))

            # OpenCV eye cascade returns eyes in face-local coords.
            # Negate x because camera is mirrored vs face orientation.
            # Actually: pupil to the RIGHT in the image = person looking LEFT
            raw_x = -raw_x

            return {"raw_x": raw_x, "raw_y": raw_y, "confidence": 0.55}
        except Exception as e:
            logger.error(f"_analyze_opencv: {e}")
            return None

    # ── Helpers ─────────────────────────────────────────────────────────────────
    def _classify(self, x: float, y: float) -> str:
        if abs(x) >= H_THRESH: return "left" if x < 0 else "right"
        if abs(y) >= V_THRESH:  return "up"   if y < 0 else "down"
        return "center"

    def _null(self):
        return {"direction": None, "gaze_x": 0.0, "gaze_y": 0.0,
                "confidence": 0.0, "flagged": False, "method": self._method, "raw": {}}

    def reset_calibration(self):
        self._cal_buf.clear()
        self._cal_x = self._cal_y = 0.0
        self._calibrated = False
        self._recent.clear()
        self._cooldown.clear()
        logger.info("EyeGazeTracker: calibration reset")

    def draw_debug(self, frame: np.ndarray, result: dict) -> np.ndarray:
        d = frame.copy()
        h, w = d.shape[:2]
        gx, gy   = result.get("gaze_x", 0), result.get("gaze_y", 0)
        direction = result.get("direction", "?")
        flagged   = result.get("flagged", False)
        method    = result.get("method", "?")
        color = (0,0,255) if flagged else (0,200,0) if direction=="center" else (0,165,255)
        cv2.putText(d, f"Gaze: {direction} [{method}]", (10,30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        cv2.putText(d, f"x={gx:+.3f} y={gy:+.3f}", (10,58), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200,200,200), 1)
        cx, cy = w//2, h//2
        cv2.arrowedLine(d, (cx,cy), (int(cx+gx*70), int(cy+gy*70)), color, 2, tipLength=0.3)
        return d
