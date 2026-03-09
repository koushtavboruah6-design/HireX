"""
audio_analysis.py — Audio Analysis for Interview Proctoring
Uses:
  - webrtcvad: Voice Activity Detection
  - librosa: Audio feature extraction, speaker count estimation
  - OpenAI Whisper: Speech transcription
  - Custom keyword detection: Flag suspicious phrases
"""
import os
import io
import tempfile
import numpy as np
from loguru import logger

try:
    import librosa
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    logger.warning("librosa not available — audio analysis limited")

try:
    import webrtcvad
    WEBRTCVAD_AVAILABLE = True
except ImportError:
    WEBRTCVAD_AVAILABLE = False
    logger.warning("webrtcvad not available — VAD disabled")

try:
    import whisper
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    logger.warning("Whisper not available — transcription disabled")

# Suspicious keywords/phrases to flag
SUSPICIOUS_KEYWORDS = [
    "answer", "what is", "tell me", "google", "search",
    "help me", "what's the answer", "look it up", "check online",
    "copy this", "type this", "write this down",
]

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")


class AudioAnalyzer:
    def __init__(self):
        self._ready = False
        self._whisper_model = None
        self._vad = None
        self._init_models()

    def _init_models(self):
        # Load Whisper (heavyweight — load lazily)
        if WHISPER_AVAILABLE:
            try:
                logger.info(f"Loading Whisper model: {WHISPER_MODEL_SIZE}")
                self._whisper_model = whisper.load_model(WHISPER_MODEL_SIZE)
                logger.info("AudioAnalyzer: Whisper loaded")
                self._ready = True
            except Exception as e:
                logger.warning(f"Whisper load failed: {e}")

        # Load WebRTC VAD
        if WEBRTCVAD_AVAILABLE:
            try:
                self._vad = webrtcvad.Vad(2)  # Aggressiveness 0-3
                if not self._ready:
                    self._ready = True
            except Exception as e:
                logger.warning(f"WebRTC VAD init failed: {e}")

        if not self._ready:
            self._ready = True  # Can still run with librosa only

    def is_ready(self) -> bool:
        return self._ready

    def analyze(self, audio_bytes: bytes) -> dict:
        """
        Analyze audio chunk.

        Returns:
            {
                voice_activity: bool,
                multiple_voices: bool,
                speaker_count: int,
                multi_voice_confidence: float,
                whispering: bool,
                whisper_confidence: float,
                transcript: str,
                suspicious_transcript: bool,
                suspicious_keywords: list[str],
                duration_s: float,
            }
        """
        result = {
            "voice_activity": False,
            "multiple_voices": False,
            "speaker_count": 1,
            "multi_voice_confidence": 0.0,
            "whispering": False,
            "whisper_confidence": 0.0,
            "transcript": "",
            "suspicious_transcript": False,
            "suspicious_keywords": [],
            "duration_s": 0.0,
        }

        # Save audio bytes to temp file
        try:
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
                f.write(audio_bytes)
                temp_path = f.name
        except Exception as e:
            logger.error(f"AudioAnalyzer: temp file error: {e}")
            return result

        try:
            # Load audio with librosa
            if LIBROSA_AVAILABLE:
                try:
                    y, sr = librosa.load(temp_path, sr=16000, mono=True)
                    result["duration_s"] = round(len(y) / sr, 2)

                    # Voice activity detection
                    result["voice_activity"] = self._detect_voice_activity(y, sr)

                    if result["voice_activity"]:
                        # Estimate number of speakers
                        speaker_analysis = self._estimate_speakers(y, sr)
                        result["multiple_voices"]     = speaker_analysis["multiple"]
                        result["speaker_count"]       = speaker_analysis["count"]
                        result["multi_voice_confidence"] = speaker_analysis["confidence"]
                        result["whispering"]          = speaker_analysis["whispering"]
                        result["whisper_confidence"]  = speaker_analysis["whisper_conf"]

                except Exception as e:
                    logger.warning(f"librosa analysis error: {e}")

            # Transcribe with Whisper
            if self._whisper_model is not None and WHISPER_AVAILABLE:
                try:
                    transcript_result = self._whisper_model.transcribe(
                        temp_path,
                        language="en",
                        fp16=False,
                        verbose=False,
                    )
                    transcript = transcript_result.get("text", "").strip()
                    result["transcript"] = transcript

                    # Check for suspicious keywords
                    if transcript:
                        found_keywords = self._check_keywords(transcript.lower())
                        result["suspicious_keywords"] = found_keywords
                        result["suspicious_transcript"] = len(found_keywords) > 0

                except Exception as e:
                    logger.warning(f"Whisper transcription error: {e}")

        finally:
            # Clean up temp file
            try:
                os.unlink(temp_path)
            except Exception:
                pass

        return result

    def _detect_voice_activity(self, y: np.ndarray, sr: int) -> bool:
        """Detect if there is significant voice activity in the audio."""
        try:
            # RMS energy check
            rms = librosa.feature.rms(y=y)[0]
            mean_rms = np.mean(rms)

            # Threshold: if average RMS > 0.01, consider it voice activity
            return float(mean_rms) > 0.01
        except Exception:
            return False

    def _estimate_speakers(self, y: np.ndarray, sr: int) -> dict:
        """
        Estimate number of speakers using spectral and pitch analysis.
        This is a heuristic approach — for production, use pyannote.audio.
        """
        try:
            # Extract pitch (fundamental frequency)
            f0, voiced_flag, _ = librosa.pyin(
                y,
                fmin=librosa.note_to_hz('C2'),
                fmax=librosa.note_to_hz('C7'),
                sr=sr,
            )

            # Filter to voiced frames
            voiced_f0 = f0[voiced_flag]

            if len(voiced_f0) < 10:
                return {"multiple": False, "count": 1, "confidence": 0, "whispering": False, "whisper_conf": 0}

            # If pitch variance is high, likely multiple speakers
            f0_std = float(np.std(voiced_f0[~np.isnan(voiced_f0)]))
            f0_mean = float(np.nanmean(voiced_f0))

            # Coefficient of variation
            cv = f0_std / (f0_mean + 1e-6)

            # Heuristic: CV > 0.3 suggests multiple pitches (different speakers)
            multiple = cv > 0.3
            confidence = min(1.0, cv / 0.5)

            # Detect whispering: low RMS + voiced speech
            rms = librosa.feature.rms(y=y)[0]
            mean_rms = float(np.mean(rms))
            whispering = 0.005 < mean_rms < 0.03 and len(voiced_f0) > 5

            return {
                "multiple":     multiple,
                "count":        2 if multiple else 1,
                "confidence":   round(confidence, 3),
                "whispering":   whispering,
                "whisper_conf": round(mean_rms * 20, 3),
            }
        except Exception as e:
            logger.warning(f"Speaker estimation error: {e}")
            return {"multiple": False, "count": 1, "confidence": 0, "whispering": False, "whisper_conf": 0}

    def _check_keywords(self, text: str) -> list:
        """Check transcript for suspicious keywords/phrases."""
        found = []
        for keyword in SUSPICIOUS_KEYWORDS:
            if keyword in text:
                found.append(keyword)
        return found
