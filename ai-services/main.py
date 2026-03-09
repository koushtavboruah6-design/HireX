"""
main.py — ProctorAI Python AI Service
"""
import os, base64, asyncio, time
from datetime import datetime
from typing import Optional

import numpy as np
import cv2
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

from eye_tracking   import EyeGazeTracker
from person_detection import PersonDetector
from head_pose      import HeadPoseEstimator
from audio_analysis import AudioAnalyzer
from scoring        import SuspicionScorer

app = FastAPI(title="ProctorAI Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

gaze_tracker    = EyeGazeTracker()
person_detector = PersonDetector()
head_pose_est   = HeadPoseEstimator()
audio_analyzer  = AudioAnalyzer()
scorer          = SuspicionScorer()

logger.info(f"AI Service initialized — gaze method: {gaze_tracker._method}")


# ── Models ────────────────────────────────────────────────────────────────────
class FrameRequest(BaseModel):
    frame: str
    sessionId: str
    timestamp: Optional[str] = None


class Alert(BaseModel):
    type: str
    severity: str
    message: str
    timestamp: str
    metadata: dict = {}


# ── Frame analysis ────────────────────────────────────────────────────────────
@app.post("/analyze/frame")
async def analyze_frame(request: FrameRequest):
    t0 = time.time()

    # Decode frame
    try:
        img_bytes = base64.b64decode(request.frame)
        arr = np.frombuffer(img_bytes, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("cv2.imdecode returned None — invalid image data")
    except Exception as e:
        raise HTTPException(400, f"Image decode error: {e}")

    ts = request.timestamp or datetime.utcnow().isoformat()
    alerts = []

    # Run in parallel
    gaze_r, person_r, head_r = await asyncio.gather(
        asyncio.to_thread(gaze_tracker.analyze,    frame),
        asyncio.to_thread(person_detector.analyze, frame),
        asyncio.to_thread(head_pose_est.analyze,   frame),
    )

    face_count   = person_r.get("face_count", 0)
    person_count = person_r.get("person_count", 0)

    # ── Face / person alerts ──────────────────────────────────────────────────
    if face_count == 0:
        alerts.append(Alert(type="no_face", severity="high",
            message="No face detected in frame", timestamp=ts,
            metadata={"confidence": person_r.get("confidence", 0)}))

    elif face_count > 1:
        alerts.append(Alert(type="multiple_faces", severity="high",
            message=f"{face_count} faces detected in frame", timestamp=ts,
            metadata={"faceCount": face_count, "personCount": person_count}))

    if person_count > 1:
        alerts.append(Alert(type="body_intrusion", severity="high",
            message=f"Multiple persons detected ({person_count})", timestamp=ts,
            metadata={"personCount": person_count}))

    if person_r.get("phone_detected"):
        alerts.append(Alert(type="phone_detected", severity="high",
            message="Mobile phone detected in frame", timestamp=ts,
            metadata={"confidence": person_r.get("phone_confidence", 0)}))

    # ── Gaze alert (only when tracker says flagged=True) ─────────────────────
    gaze_dir = gaze_r.get("direction")
    if gaze_r.get("flagged") and gaze_dir and gaze_dir != "center" and face_count > 0:
        alerts.append(Alert(type="gaze_away", severity="medium",
            message=f"Candidate looking {gaze_dir} — sustained gaze away from screen",
            timestamp=ts,
            metadata={
                "direction":  gaze_dir,
                "gazeX":      gaze_r.get("gaze_x", 0),
                "gazeY":      gaze_r.get("gaze_y", 0),
                "confidence": gaze_r.get("confidence", 0),
                "method":     gaze_r.get("method", "unknown"),
            }))

    # ── Head pose alert ───────────────────────────────────────────────────────
    if head_r.get("flagged") and face_count > 0:
        alerts.append(Alert(type="head_pose", severity="medium",
            message=f"Head turned away: yaw={head_r.get('yaw',0):.0f}° pitch={head_r.get('pitch',0):.0f}°",
            timestamp=ts,
            metadata={"yaw": head_r.get("yaw"), "pitch": head_r.get("pitch"), "roll": head_r.get("roll")}))

    ms = round((time.time() - t0) * 1000, 1)
    logger.debug(f"[Frame] {request.sessionId} faces={face_count} gaze={gaze_dir} alerts={len(alerts)} ms={ms}")

    return {
        "sessionId":   request.sessionId,
        "alerts":      [a.dict() for a in alerts],
        "faceCount":   face_count,
        "gazeDirection": gaze_dir,
        "gazeMethod":  gaze_r.get("method"),
        "headPose":    {"yaw": head_r.get("yaw"), "pitch": head_r.get("pitch"), "roll": head_r.get("roll")},
        "confidence":  person_r.get("confidence", 0),
        "processingMs": ms,
    }


# ── Audio analysis ────────────────────────────────────────────────────────────
@app.post("/analyze/audio")
async def analyze_audio(
    audio: UploadFile = File(...),
    sessionId: str = Form(...),
    timestamp: str = Form(default=None),
):
    try:
        audio_bytes = await audio.read()
        ts = timestamp or datetime.utcnow().isoformat()
        result = await asyncio.to_thread(audio_analyzer.analyze, audio_bytes)
        alerts = []

        if result.get("multiple_voices"):
            alerts.append({"type": "extra_voice", "severity": "medium",
                "message": "Multiple voices detected", "timestamp": ts,
                "metadata": {"speakerCount": result.get("speaker_count", 2)}})

        if result.get("suspicious_transcript"):
            alerts.append({"type": "suspicious_audio", "severity": "medium",
                "message": "Suspicious speech detected",
                "timestamp": ts,
                "metadata": {"transcript": result.get("transcript", ""),
                             "keywords": result.get("suspicious_keywords", [])}})

        if result.get("whispering"):
            alerts.append({"type": "extra_voice", "severity": "low",
                "message": "Whispering detected", "timestamp": ts, "metadata": {}})

        return {"sessionId": sessionId, "alerts": alerts, "analysis": result}
    except Exception as e:
        logger.error(f"[Audio] {e}")
        return {"sessionId": sessionId, "alerts": [], "error": str(e)}


# ── Session start (reset calibration) ────────────────────────────────────────
@app.post("/session/start")
async def session_start(body: dict):
    gaze_tracker.reset_calibration()
    logger.info(f"Calibration reset for session={body.get('sessionId')}")
    return {"status": "ok"}


# ── Debug endpoint — returns annotated JPEG ──────────────────────────────────
@app.post("/debug/frame")
async def debug_frame(request: FrameRequest):
    """
    Same as /analyze/frame but also returns an annotated JPEG showing
    what the AI is detecting. Use this to verify detection is working.
    Response includes base64 debug_image you can display in browser.
    """
    try:
        img_bytes = base64.b64decode(request.frame)
        arr = np.frombuffer(img_bytes, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise HTTPException(400, "Invalid frame")
    except Exception as e:
        raise HTTPException(400, str(e))

    # Run analysis
    gaze_r   = gaze_tracker.analyze(frame)
    person_r = person_detector.analyze(frame)
    head_r   = head_pose_est.analyze(frame)

    # Draw annotations
    debug = person_detector.draw_debug(frame, person_r)
    debug = gaze_tracker.draw_debug(debug, gaze_r)
    debug = head_pose_est.draw_debug(debug, head_r)

    # Add status overlay
    h, w = debug.shape[:2]
    info_lines = [
        f"Method: {gaze_r.get('method','?')}",
        f"Faces: {person_r['face_count']}  Persons: {person_r['person_count']}",
        f"Gaze: {gaze_r.get('direction','?')}  conf={gaze_r.get('confidence',0):.2f}",
        f"Flagged: {gaze_r.get('flagged', False)}",
        f"Head yaw={head_r.get('yaw',0):.1f} pitch={head_r.get('pitch',0):.1f}",
    ]
    y0 = h - len(info_lines) * 22 - 10
    cv2.rectangle(debug, (5, y0 - 5), (300, h - 5), (0, 0, 0), -1)
    for i, line in enumerate(info_lines):
        cv2.putText(debug, line, (10, y0 + i * 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0), 1)

    _, buf = cv2.imencode('.jpg', debug, [cv2.IMWRITE_JPEG_QUALITY, 85])
    debug_b64 = base64.b64encode(buf).decode('utf-8')

    return {
        "debug_image": debug_b64,
        "gaze":   gaze_r,
        "person": person_r,
        "head":   head_r,
    }


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models": {
            "gaze_tracker":    gaze_tracker.is_ready(),
            "gaze_method":     gaze_tracker._method,
            "person_detector": person_detector.is_ready(),
            "person_mode":     "yolo+opencv" if person_detector._use_yolo else "opencv_only",
            "head_pose":       head_pose_est.is_ready(),
            "audio_analyzer":  audio_analyzer.is_ready(),
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=os.getenv("HOST","0.0.0.0"),
                port=int(os.getenv("PORT", 8000)), reload=True,
                log_level=os.getenv("LOG_LEVEL","info").lower())
