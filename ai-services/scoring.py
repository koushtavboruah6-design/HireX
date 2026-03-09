"""
scoring.py — Suspicion Score Calculation System
Maintains a weighted, time-decaying suspicion score per session.
"""
import time
from dataclasses import dataclass, field
from typing import Dict, List
from loguru import logger

# Alert weights (how much each event adds to the score)
ALERT_WEIGHTS = {
    "gaze_away":       2,
    "multiple_faces":  5,
    "extra_voice":     3,
    "body_intrusion":  4,
    "tab_switch":      3,
    "head_pose":       2,
    "no_face":         4,
    "suspicious_audio":3,
    "phone_detected":  5,
    "low_conf_face":   1,
}

# How quickly score decays (points per minute without alerts)
DECAY_RATE_PER_MINUTE = 1.0

# Maximum possible score
MAX_SCORE = 100

# Risk thresholds
MEDIUM_THRESHOLD = 20
HIGH_THRESHOLD   = 50


@dataclass
class SessionScore:
    session_id: str
    score: float = 0.0
    last_update: float = field(default_factory=time.time)
    event_history: List[dict] = field(default_factory=list)
    category_counts: Dict[str, int] = field(default_factory=dict)


class SuspicionScorer:
    def __init__(self):
        self._sessions: Dict[str, SessionScore] = {}
        logger.info("SuspicionScorer initialized")

    def is_ready(self) -> bool:
        return True

    def get_session(self, session_id: str) -> SessionScore:
        if session_id not in self._sessions:
            self._sessions[session_id] = SessionScore(session_id=session_id)
        return self._sessions[session_id]

    def add_event(self, session_id: str, event_type: str, metadata: dict = None) -> dict:
        """
        Add an event to the session's suspicion score.

        Returns:
            {
                score: float,
                risk_level: str,
                added_points: float,
                total_events: int,
            }
        """
        session = self.get_session(session_id)

        # Apply time decay first
        self._apply_decay(session)

        # Add points for this event
        weight = ALERT_WEIGHTS.get(event_type, 1)
        session.score = min(MAX_SCORE, session.score + weight)
        session.last_update = time.time()

        # Update category counts
        if event_type not in session.category_counts:
            session.category_counts[event_type] = 0
        session.category_counts[event_type] += 1

        # Add to history
        session.event_history.append({
            "type": event_type,
            "weight": weight,
            "timestamp": time.time(),
            "metadata": metadata or {},
        })

        # Keep history bounded
        if len(session.event_history) > 1000:
            session.event_history = session.event_history[-500:]

        risk_level = self._get_risk_level(session.score)

        logger.debug(
            f"[Score] session={session_id} event={event_type} "
            f"+{weight} → {session.score:.1f} ({risk_level})"
        )

        return {
            "score":        round(session.score, 1),
            "risk_level":   risk_level,
            "added_points": weight,
            "total_events": len(session.event_history),
        }

    def get_score(self, session_id: str) -> dict:
        """Get current score for a session (with decay applied)."""
        session = self.get_session(session_id)
        self._apply_decay(session)

        return {
            "score":           round(session.score, 1),
            "risk_level":      self._get_risk_level(session.score),
            "category_counts": dict(session.category_counts),
            "total_events":    len(session.event_history),
        }

    def get_cheating_probability(self, session_id: str) -> float:
        """
        Compute a probability estimate (0-1) of cheating based on
        event patterns, not just raw score.
        """
        session = self.get_session(session_id)
        events = session.event_history

        if not events:
            return 0.0

        # Factors:
        # 1. Raw score component (50% weight)
        score_prob = session.score / MAX_SCORE * 0.5

        # 2. High-severity event frequency (30% weight)
        high_severity_types = {"multiple_faces", "phone_detected", "body_intrusion", "no_face"}
        high_count = sum(1 for e in events if e["type"] in high_severity_types)
        freq_prob = min(1.0, high_count / 5) * 0.3

        # 3. Correlated events (20% weight)
        # If gaze_away AND extra_voice → more suspicious
        has_gaze  = session.category_counts.get("gaze_away", 0) > 0
        has_voice = session.category_counts.get("extra_voice", 0) > 0
        has_face  = session.category_counts.get("multiple_faces", 0) > 0
        corr_score = sum([has_gaze and has_voice, has_face]) * 0.1

        probability = min(1.0, score_prob + freq_prob + corr_score)
        return round(probability, 3)

    def _apply_decay(self, session: SessionScore):
        """Reduce score based on elapsed time since last event."""
        if session.score <= 0:
            return
        elapsed_minutes = (time.time() - session.last_update) / 60.0
        decay = elapsed_minutes * DECAY_RATE_PER_MINUTE
        session.score = max(0, session.score - decay)

    def _get_risk_level(self, score: float) -> str:
        if score >= HIGH_THRESHOLD:
            return "high"
        elif score >= MEDIUM_THRESHOLD:
            return "medium"
        return "low"

    def reset_session(self, session_id: str):
        """Reset a session's score (e.g., at interview end)."""
        if session_id in self._sessions:
            del self._sessions[session_id]

    def get_all_sessions(self) -> List[dict]:
        """Get scores for all active sessions."""
        return [
            {"session_id": sid, **self.get_score(sid)}
            for sid in self._sessions
        ]
