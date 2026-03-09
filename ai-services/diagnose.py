"""
diagnose.py — Run this FIRST to find exactly what's broken.
Usage: python diagnose.py

Checks:
  1. All library imports
  2. MediaPipe face mesh + iris landmarks on a synthetic face
  3. OpenCV face cascade on a synthetic face
  4. YOLO model availability
  5. Gaze calculation correctness
  6. Frame decode pipeline
"""
import sys, base64, os
import numpy as np
import cv2

print("=" * 60)
print("ProctorAI Diagnostics")
print("=" * 60)

errors = []

# ── 1. Library checks ──────────────────────────────────────────
print("\n[1] Library imports")

libs = {
    "numpy":      "import numpy",
    "cv2":        "import cv2",
    "mediapipe":  "import mediapipe as mp",
    "ultralytics":"from ultralytics import YOLO",
    "librosa":    "import librosa",
    "whisper":    "import whisper",
    "fastapi":    "import fastapi",
    "uvicorn":    "import uvicorn",
}

available = {}
for name, stmt in libs.items():
    try:
        exec(stmt)
        print(f"  ✓ {name}")
        available[name] = True
    except ImportError as e:
        print(f"  ✗ {name}: {e}")
        available[name] = False
        if name in ("numpy", "cv2", "fastapi"):
            errors.append(f"CRITICAL: {name} missing")

# ── 2. Create a realistic synthetic test face ──────────────────
print("\n[2] Creating synthetic test frame")
frame = np.zeros((480, 640, 3), dtype=np.uint8)
frame[:] = (40, 40, 40)  # dark background
# Face oval
cv2.ellipse(frame, (320, 240), (120, 150), 0, 0, 360, (200, 180, 160), -1)
# Eyes
cv2.ellipse(frame, (270, 200), (28, 14), 0, 0, 360, (255, 255, 255), -1)
cv2.ellipse(frame, (370, 200), (28, 14), 0, 0, 360, (255, 255, 255), -1)
cv2.circle(frame, (270, 200), 9, (50, 50, 50), -1)   # left pupil
cv2.circle(frame, (370, 200), 9, (50, 50, 50), -1)   # right pupil
cv2.circle(frame, (270, 200), 4, (10, 10, 10), -1)   # iris center
cv2.circle(frame, (370, 200), 4, (10, 10, 10), -1)
# Nose
cv2.circle(frame, (320, 250), 8, (170, 150, 130), -1)
# Mouth
cv2.ellipse(frame, (320, 300), (40, 15), 0, 0, 180, (150, 80, 80), 2)
print("  ✓ Synthetic frame created (480x640)")

# Save for inspection
cv2.imwrite("/tmp/test_face.jpg", frame)
print("  ✓ Saved to /tmp/test_face.jpg")

# ── 3. OpenCV face detection ───────────────────────────────────
print("\n[3] OpenCV face detection")
try:
    cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    face_cascade = cv2.CascadeClassifier(cascade_path)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.1, 3, minSize=(30, 30))
    print(f"  ✓ Cascade loaded: {cascade_path}")
    print(f"  {'✓' if len(faces) > 0 else '⚠'} Detected {len(faces)} face(s) on synthetic frame")
    if len(faces) == 0:
        print("    NOTE: Synthetic face may not trigger cascade — test with real webcam frame")
except Exception as e:
    print(f"  ✗ OpenCV cascade error: {e}")
    errors.append(f"OpenCV cascade: {e}")

# ── 4. MediaPipe face mesh ─────────────────────────────────────
print("\n[4] MediaPipe face mesh + iris")
if available.get("mediapipe"):
    try:
        import mediapipe as mp
        mp_fm = mp.solutions.face_mesh
        
        # Test WITHOUT refine_landmarks
        with mp_fm.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=False) as fm:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = fm.process(rgb)
            basic_ok = result.multi_face_landmarks is not None
            lm_count = len(result.multi_face_landmarks[0].landmark) if basic_ok else 0
            print(f"  {'✓' if basic_ok else '⚠'} Basic face mesh: detected={basic_ok}, landmarks={lm_count}")

        # Test WITH refine_landmarks (required for iris)
        with mp_fm.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True) as fm:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = fm.process(rgb)
            iris_ok = result.multi_face_landmarks is not None
            lm_count = len(result.multi_face_landmarks[0].landmark) if iris_ok else 0
            has_iris = lm_count >= 478
            print(f"  {'✓' if iris_ok else '⚠'} Iris face mesh: detected={iris_ok}, landmarks={lm_count}")
            print(f"  {'✓' if has_iris else '✗'} Iris landmarks (need 478, got {lm_count})")
            if iris_ok and not has_iris:
                errors.append("MediaPipe returned face but NOT iris landmarks — refine_landmarks may not be working")
            if not iris_ok:
                print("    NOTE: Synthetic face won't trigger MediaPipe — it needs a REAL photo")
                print("    The tracker will work on real webcam frames")
    except Exception as e:
        print(f"  ✗ MediaPipe error: {e}")
        errors.append(f"MediaPipe: {e}")
else:
    print("  ✗ MediaPipe not installed")
    errors.append("MediaPipe not installed — run: pip install mediapipe==0.10.9")

# ── 5. YOLO ───────────────────────────────────────────────────
print("\n[5] YOLOv8 model")
if available.get("ultralytics"):
    try:
        from ultralytics import YOLO
        model_path = "yolov8n.pt"
        if os.path.exists(model_path):
            print(f"  ✓ Model file exists: {model_path}")
        else:
            print(f"  ⚠ Model not found locally: {model_path}")
            print("    Will auto-download on first use (~6MB)")
        
        # Try loading (downloads if needed)
        model = YOLO(model_path)
        results = model(frame, verbose=False, conf=0.3)
        print(f"  ✓ YOLO loaded and ran inference")
        print(f"  ✓ Detected {sum(len(r.boxes) for r in results)} objects on synthetic frame")
    except Exception as e:
        print(f"  ✗ YOLO error: {e}")
        errors.append(f"YOLO: {e}")
else:
    print("  ✗ ultralytics not installed — run: pip install ultralytics")
    errors.append("ultralytics not installed")

# ── 6. Frame decode pipeline ───────────────────────────────────
print("\n[6] Frame encode/decode pipeline (simulates frontend→AI)")
try:
    # Simulate what the browser sends
    _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    b64 = base64.b64encode(buf).decode('utf-8')
    
    # Simulate what the AI service receives
    decoded_bytes = base64.b64decode(b64)
    arr = np.frombuffer(decoded_bytes, dtype=np.uint8)
    decoded_frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    
    ok = decoded_frame is not None and decoded_frame.shape == frame.shape
    print(f"  ✓ Encode: {len(b64)} chars of base64")
    print(f"  {'✓' if ok else '✗'} Decode: shape={decoded_frame.shape if decoded_frame is not None else 'None'}")
    
    if not ok:
        errors.append("Frame decode pipeline broken")
except Exception as e:
    print(f"  ✗ Pipeline error: {e}")
    errors.append(f"Frame pipeline: {e}")

# ── 7. Test actual gaze tracker ────────────────────────────────
print("\n[7] EyeGazeTracker module")
try:
    from eye_tracking import EyeGazeTracker
    tracker = EyeGazeTracker()
    print(f"  ✓ Loaded, ready={tracker.is_ready()}")
    result = tracker.analyze(frame)
    print(f"  ✓ analyze() returned: direction={result['direction']} conf={result['confidence']}")
    print(f"     gaze_x={result['gaze_x']} gaze_y={result['gaze_y']} flagged={result['flagged']}")
    if result['direction'] is None and not result['confidence']:
        print("    NOTE: No face detected on synthetic frame — expected, works on real frames")
except Exception as e:
    print(f"  ✗ EyeGazeTracker error: {e}")
    errors.append(f"EyeGazeTracker: {e}")

# ── 8. Test person detector ────────────────────────────────────
print("\n[8] PersonDetector module")
try:
    from person_detection import PersonDetector
    detector = PersonDetector()
    print(f"  ✓ Loaded, ready={detector.is_ready()}")
    result = detector.analyze(frame)
    print(f"  ✓ analyze() returned: faces={result['face_count']} persons={result['person_count']}")
    print(f"     phone={result['phone_detected']} conf={result['confidence']}")
except Exception as e:
    print(f"  ✗ PersonDetector error: {e}")
    errors.append(f"PersonDetector: {e}")

# ── Summary ────────────────────────────────────────────────────
print("\n" + "=" * 60)
if errors:
    print(f"FOUND {len(errors)} ISSUE(S):")
    for i, e in enumerate(errors, 1):
        print(f"  {i}. {e}")
    print("\nFix these first, then restart: python main.py")
else:
    print("✓ All checks passed — AI service should work correctly")
    print("\nIf features still fail on real frames:")
    print("  - Ensure good lighting on the candidate's face")
    print("  - Ensure face is clearly visible and not too small")
    print("  - Check AI service logs: uvicorn logs the frame analysis")
print("=" * 60)
