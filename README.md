# ProctorAI — AI-Powered Interview Proctoring System

> Production-ready full-stack interview integrity platform using real-time computer vision, gaze tracking, and audio analysis.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                  │
│  ┌──────────────────┐       ┌───────────────────────────────┐   │
│  │  Candidate View  │       │    Recruiter Dashboard        │   │
│  │  (CandidatePage) │       │   (RecruiterDashboard.jsx)    │   │
│  │  - Webcam feed   │       │   - Live session list         │   │
│  │  - Tab monitor   │       │   - Alert timeline            │   │
│  │  - Status UI     │       │   - Risk score meter          │   │
│  └────────┬─────────┘       └───────────────┬───────────────┘   │
│           │ HTTP (frames)                   │ WebSocket         │
└───────────┼─────────────────────────────────┼───────────────────┘
            │                                 │
            ▼                                 ▼
┌───────────────────────────────────────────────────────────────┐
│              Node.js Backend  (Express + Socket.io)            │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ /api/sessions│  │ /api/alerts  │  │   Socket.io Rooms    │  │
│  │ /api/reports │  │ /api/auth    │  │  recruiter_room      │  │
│  └─────────────┘  └──────────────┘  │  session:{id}        │  │
│                                     └──────────────────────┘  │
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTP (frames, audio)
                            ▼
┌──────────────────────────────────────────────────────────────┐
│              Python AI Service (FastAPI)                      │
│  ┌────────────────┐  ┌───────────────┐  ┌────────────────┐  │
│  │  EyeGazeTracker│  │ PersonDetector │  │ HeadPoseEst.   │  │
│  │  (MediaPipe)   │  │ (YOLOv8)       │  │ (solvePnP)     │  │
│  └────────────────┘  └───────────────┘  └────────────────┘  │
│  ┌────────────────┐  ┌───────────────┐                       │
│  │  AudioAnalyzer │  │  Scoring      │                       │
│  │  (Whisper+VAD) │  │  Engine       │                       │
│  └────────────────┘  └───────────────┘                       │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   MongoDB     │
                    │  Sessions     │
                    │  Alerts       │
                    └───────────────┘
```

---

## Project Structure

```
ai-proctoring-system/
├── frontend/                         # React.js + TailwindCSS
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx       # Home: candidate/recruiter entry
│   │   │   ├── CandidatePage.jsx     # Interview monitoring view
│   │   │   ├── RecruiterDashboard.jsx# Live monitoring dashboard
│   │   │   └── ReportPage.jsx        # Final report with PDF export
│   │   ├── components/
│   │   │   ├── SuspicionMeter.jsx    # Circular risk gauge
│   │   │   └── AlertTimeline.jsx     # Live alert feed
│   │   ├── hooks/
│   │   │   └── useProctoring.js      # Frame capture + socket + tab detection
│   │   ├── context/
│   │   │   └── SessionContext.jsx    # Global session state
│   │   └── index.css                 # Tailwind + custom animations
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── backend/                          # Node.js + Express + Socket.io
│   ├── server.js                     # Entry point
│   ├── routes/
│   │   ├── sessions.js               # Session CRUD + join/end
│   │   ├── alerts.js                 # Alert creation + queries
│   │   ├── reports.js                # Report data + PDF stream
│   │   └── auth.js                   # JWT auth for recruiters
│   ├── models/
│   │   ├── Session.js                # MongoDB session schema
│   │   └── Alert.js                  # MongoDB alert schema
│   ├── services/
│   │   ├── socketService.js          # Real-time event routing
│   │   └── reportService.js          # PDFKit report generation
│   ├── config/
│   │   └── database.js               # MongoDB connection
│   ├── scripts/
│   │   └── seed.js                   # Demo data seeder
│   └── package.json
│
├── ai-services/                      # Python FastAPI AI Service
│   ├── main.py                       # FastAPI app + endpoints
│   ├── eye_tracking.py               # MediaPipe iris/gaze analysis
│   ├── person_detection.py           # YOLOv8 person/object detection
│   ├── head_pose.py                  # 3D head pose estimation (solvePnP)
│   ├── audio_analysis.py             # Whisper + VAD + speaker detection
│   ├── scoring.py                    # Weighted suspicion score engine
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml                # Full stack orchestration
└── README.md
```

---

## Features

### Candidate-Side Monitoring
| Feature | Technology |
|---|---|
| Webcam capture (720p) | WebRTC + MediaDevices API |
| Frame streaming to AI | Base64 JPEG, every 1.5 seconds |
| Audio capture + streaming | MediaRecorder API, 5-second chunks |
| Tab switch detection | `visibilitychange` + `blur` events |
| Right-click prevention | `contextmenu` event |
| Real-time alert display | Socket.io |
| Session timer | React state |

### AI Analysis
| Feature | Model | Description |
|---|---|---|
| Eye gaze tracking | MediaPipe Face Mesh (iris) | Detects gaze direction: left/right/up/down/center |
| Face count | YOLOv8n + OpenCV Haar | Flags 0 or 2+ faces |
| Person detection | YOLOv8n | Detects multiple people in frame |
| Phone detection | YOLOv8n | COCO class 67 (cell phone) |
| Head pose | OpenCV solvePnP | Yaw/pitch/roll from 6-point face model |
| Voice activity | librosa RMS energy | Detects speech presence |
| Speaker count | librosa pitch analysis (pyin) | Estimates multiple voices |
| Whispering | RMS thresholds | Low-energy voiced speech detection |
| Transcription | OpenAI Whisper | Full speech-to-text |
| Keyword detection | String matching | Flags suspicious phrases |

### Suspicion Scoring System
```
Event Type           Weight   Severity
───────────────────────────────────────
Looking Away           +2      Medium
No Face Detected       +4      High
Multiple Faces         +5      High
Body Intrusion         +4      High
Phone Detected         +5      High
Extra Voice            +3      Medium
Suspicious Audio       +3      Medium
Tab Switch             +3      Medium
Head Turned            +2      Medium

Score  0–19  → LOW RISK    (green)
Score 20–49  → MEDIUM RISK (amber)
Score 50–100 → HIGH RISK   (red)
```

---

## Setup Instructions

### Prerequisites
- Node.js 20+
- Python 3.11+
- MongoDB 7.0+ (local or Atlas)
- FFmpeg (`apt install ffmpeg` / `brew install ffmpeg`)

---

### Option A: Docker Compose (Recommended)

```bash
# 1. Clone the repo
git clone https://github.com/koushtavboruah6-design/HireX.git
cd ai-proctoring-system

# 2. Start all services
docker compose up --build

# 3. Visit:
#   Frontend:   http://localhost:3000
#   Backend:    http://localhost:5000/api/health
#   AI Service: http://localhost:8000/health
```

---

### Option B: Manual Setup

#### Step 1 — MongoDB
```bash
mongod --dbpath /data/db
```

#### Step 2 — Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env: set MONGODB_URI and JWT_SECRET
npm run dev
# → http://localhost:5000
```

#### Step 3 — AI Services
```bash
cd ai-services
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python main.py
# → http://localhost:8000
```

#### Step 4 — Frontend
```bash
cd frontend
npm install
# Create .env.local:
echo "VITE_BACKEND_URL=http://localhost:5000" > .env.local
echo "VITE_AI_SERVICE_URL=http://localhost:8000" >> .env.local
npm run dev
# → http://localhost:3000
```

#### Step 5 — Seed Demo Data (optional)
```bash
cd backend
node scripts/seed.js
# Creates 3 demo sessions with alerts
```

---

## Quick Run Commands

```bash
# Docker (everything at once)
docker compose up --build

# Individual services
cd backend      && npm run dev
cd ai-services  && uvicorn main:app --reload --port 8000
cd frontend     && npm run dev

# Seed DB with demo data
cd backend && node scripts/seed.js

# Build frontend for production
cd frontend && npm run build
```

---

## API Reference

### Backend REST

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sessions/join` | Join or create interview session |
| `GET` | `/api/sessions` | List all sessions |
| `GET` | `/api/sessions/:id` | Get session details |
| `POST` | `/api/sessions/:id/end` | End a session, compute final verdict |
| `POST` | `/api/alerts` | Create alert (from AI service) |
| `GET` | `/api/alerts/:sessionId` | Get all alerts for session |
| `GET` | `/api/reports/:sessionId` | Get JSON report data |
| `GET` | `/api/reports/:sessionId/pdf` | Download PDF report |
| `POST` | `/api/auth/login` | Recruiter login → JWT |
| `GET` | `/api/health` | Health check |

### AI Service REST

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/analyze/frame` | Analyze video frame (JSON + base64) |
| `POST` | `/analyze/audio` | Analyze audio chunk (multipart form) |
| `GET` | `/health` | AI model status |

### Socket.io Events

**Candidate → Server:**
```js
socket.emit('join_session',    { sessionId })
socket.emit('candidate_alert', { sessionId, type, message, severity, metadata })
socket.emit('heartbeat',       { sessionId, suspicionScore })
```

**Recruiter → Server:**
```js
socket.emit('watch_session', { sessionId })
socket.emit('end_session',   { sessionId })
```

**Server → Candidate:**
```js
socket.on('alert',           alert)
socket.on('session_ended',   { sessionId })
```

**Server → Recruiter:**
```js
socket.on('candidate_alert',      alert)
socket.on('new_session',          session)
socket.on('session_update',       update)
socket.on('candidate_connected',  { sessionId })
socket.on('candidate_disconnected',{ sessionId })
socket.on('active_sessions',      sessions[])
```

---

## Deployment Guide

### Production Checklist
- [ ] Set strong `JWT_SECRET` (32+ random chars)
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS (required for webcam access)
- [ ] Use MongoDB Atlas for hosted DB
- [ ] Set `FRONTEND_URL` to actual domain in backend `.env`
- [ ] Use `WHISPER_MODEL=small` or `medium` for better accuracy
- [ ] Point `YOLO_MODEL_PATH` to pre-downloaded `yolov8s.pt` for better detection

### Nginx Reverse Proxy (production)
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / { proxy_pass http://localhost:3000; }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
    }

    location /socket.io {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Webcam not starting | HTTPS required in production; use `localhost` in dev |
| AI service slow | Set `WHISPER_MODEL=tiny` for faster (less accurate) transcription |
| YOLO model not found | Pre-download: `python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"` |
| Socket.io CORS error | Confirm `FRONTEND_URL` in backend `.env` matches your browser origin |
| MongoDB connection refused | Ensure MongoDB is running: `mongod --dbpath /data/db` |
| MediaPipe iris not detected | Confirm `refine_landmarks=True` in FaceMesh constructor |
| Audio analysis failing | Install ffmpeg: `apt install ffmpeg` / `brew install ffmpeg` |
| libGL error in Docker | Use `opencv-python-headless` (already in requirements.txt) |

---

## Demo Credentials

```
Recruiter Login:
  Email:    recruiter@company.com
  Password: demo1234

Demo Session IDs (after seeding):
  sess-demo-001 — Koushtav    (HIGH RISK)
  sess-demo-002 — Kirtiman  (MEDIUM RISK)
  sess-demo-003 — Padmaksh   (LOW RISK)
```

---

*Built for hackathons, research, and production use. MIT Licensed.*
