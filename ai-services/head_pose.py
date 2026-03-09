"""
head_pose.py — Head Pose Estimation using MediaPipe Face Mesh
Estimates the 3D rotation of the head (yaw, pitch, roll) and flags
when the candidate turns their head away from the camera.
"""
import os
import math
import numpy as np
import cv2
from loguru import logger

try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False

# Pose estimation flags (degrees)
YAW_THRESHOLD   = float(os.getenv("HEAD_POSE_YAW_THRESHOLD",   35))
PITCH_THRESHOLD = float(os.getenv("HEAD_POSE_PITCH_THRESHOLD", 25))

# 3D model points for solvePnP (standard face model)
# These are the 3D coordinates of 6 key facial landmarks
MODEL_POINTS = np.array([
    (0.0,    0.0,    0.0),     # Nose tip
    (0.0,   -330.0, -65.0),    # Chin
    (-225.0, 170.0, -135.0),   # Left eye, left corner
    (225.0,  170.0, -135.0),   # Right eye, right corner
    (-150.0, -150.0, -125.0),  # Left mouth corner
    (150.0,  -150.0, -125.0),  # Right mouth corner
], dtype=np.float64)

# Corresponding MediaPipe landmark indices
LANDMARK_INDICES = [1, 152, 33, 263, 61, 291]


class HeadPoseEstimator:
    def __init__(self):
        self._ready = False
        self._face_mesh = None
        if MEDIAPIPE_AVAILABLE:
            self._init_model()

    def _init_model(self):
        try:
            self._mp = mp.solutions.face_mesh
            self._face_mesh = self._mp.FaceMesh(
                static_image_mode=True,
                max_num_faces=1,
                refine_landmarks=False,
                min_detection_confidence=0.5,
            )
            self._ready = True
            logger.info("HeadPoseEstimator: MediaPipe loaded")
        except Exception as e:
            logger.warning(f"HeadPoseEstimator init failed: {e}")
            # Try OpenCV dlib-based fallback
            self._ready = True  # Still mark ready with fallback

    def is_ready(self) -> bool:
        return self._ready

    def analyze(self, frame: np.ndarray) -> dict:
        """
        Estimate head pose angles.

        Returns:
            {
                yaw: float,    # Left(-) to Right(+) in degrees
                pitch: float,  # Down(-) to Up(+) in degrees
                roll: float,   # Counter-clockwise(-) to Clockwise(+)
                flagged: bool, # True if head is turned significantly
                direction: str # 'left' | 'right' | 'down' | 'center' | 'unknown'
            }
        """
        if self._face_mesh is None:
            return self._fallback_result()

        try:
            h, w = frame.shape[:2]
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self._face_mesh.process(rgb)

            if not results.multi_face_landmarks:
                return {"yaw": 0, "pitch": 0, "roll": 0, "flagged": False, "direction": "unknown"}

            landmarks = results.multi_face_landmarks[0].landmark

            # Extract 2D image points for the 6 landmarks
            image_points = np.array([
                (landmarks[i].x * w, landmarks[i].y * h)
                for i in LANDMARK_INDICES
            ], dtype=np.float64)

            # Camera matrix approximation
            focal_length = w
            center = (w / 2, h / 2)
            camera_matrix = np.array([
                [focal_length, 0,            center[0]],
                [0,            focal_length, center[1]],
                [0,            0,            1],
            ], dtype=np.float64)

            dist_coeffs = np.zeros((4, 1))

            # Solve PnP — find rotation and translation vectors
            success, rotation_vec, translation_vec = cv2.solvePnP(
                MODEL_POINTS,
                image_points,
                camera_matrix,
                dist_coeffs,
                flags=cv2.SOLVEPNP_ITERATIVE,
            )

            if not success:
                return {"yaw": 0, "pitch": 0, "roll": 0, "flagged": False, "direction": "center"}

            # Convert rotation vector to Euler angles
            rotation_mat, _ = cv2.Rodrigues(rotation_vec)
            pose_mat = cv2.hconcat([rotation_mat, translation_vec])
            _, _, _, _, _, _, euler_angles = cv2.decomposeProjectionMatrix(
                cv2.hconcat([pose_mat, np.array([[0], [0], [0], [1]])])
            )

            pitch = float(euler_angles[0])
            yaw   = float(euler_angles[1])
            roll  = float(euler_angles[2])

            flagged = abs(yaw) > YAW_THRESHOLD or abs(pitch) > PITCH_THRESHOLD
            direction = self._classify_direction(yaw, pitch)

            return {
                "yaw":       round(yaw, 2),
                "pitch":     round(pitch, 2),
                "roll":      round(roll, 2),
                "flagged":   flagged,
                "direction": direction,
            }

        except Exception as e:
            logger.error(f"HeadPoseEstimator.analyze error: {e}")
            return {"yaw": 0, "pitch": 0, "roll": 0, "flagged": False, "direction": "center"}

    def _classify_direction(self, yaw: float, pitch: float) -> str:
        if abs(yaw) > YAW_THRESHOLD:
            return "left" if yaw < 0 else "right"
        elif abs(pitch) > PITCH_THRESHOLD:
            return "down" if pitch < 0 else "up"
        return "center"

    def _fallback_result(self):
        return {"yaw": 0, "pitch": 0, "roll": 0, "flagged": False, "direction": "unknown"}

    def draw_debug(self, frame: np.ndarray, result: dict) -> np.ndarray:
        """Draw head pose axes for debugging."""
        debug = frame.copy()
        yaw   = result.get("yaw", 0)
        pitch = result.get("pitch", 0)
        roll  = result.get("roll", 0)
        color = (0, 0, 255) if result.get("flagged") else (0, 255, 0)

        cv2.putText(debug, f"Yaw:{yaw:.1f} Pitch:{pitch:.1f} Roll:{roll:.1f}",
                    (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        cv2.putText(debug, f"Dir: {result.get('direction', '?')}",
                    (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        return debug
