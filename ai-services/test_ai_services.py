"""
test_ai_services.py
Quick smoke test for all AI modules.
Run: python test_ai_services.py

Tests:
  - EyeGazeTracker with a blank frame
  - PersonDetector with a blank frame
  - HeadPoseEstimator with a blank frame
  - AudioAnalyzer with silence bytes
  - SuspicionScorer with mock events
"""
import numpy as np
import sys

def test_color(ok: bool) -> str:
    return '\033[92m✓\033[0m' if ok else '\033[91m✗\033[0m'

def run_tests():
    results = {}

    # Create a dummy 480x640 BGR frame (black)
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    # Add a simple white circle as a "face"
    import cv2
    cv2.circle(dummy_frame, (320, 240), 100, (200, 200, 200), -1)

    # 1. EyeGazeTracker
    print("\n[1/5] Testing EyeGazeTracker...")
    try:
        from eye_tracking import EyeGazeTracker
        tracker = EyeGazeTracker()
        result = tracker.analyze(dummy_frame)
        assert isinstance(result, dict), "Expected dict result"
        assert 'direction' in result, "Missing 'direction' key"
        assert 'gaze_x' in result, "Missing 'gaze_x' key"
        print(f"  {test_color(True)} Ready: {tracker.is_ready()}")
        print(f"  {test_color(True)} Result: {result}")
        results['eye_tracking'] = True
    except Exception as e:
        print(f"  {test_color(False)} FAILED: {e}")
        results['eye_tracking'] = False

    # 2. PersonDetector
    print("\n[2/5] Testing PersonDetector...")
    try:
        from person_detection import PersonDetector
        detector = PersonDetector()
        result = detector.analyze(dummy_frame)
        assert isinstance(result, dict), "Expected dict result"
        assert 'face_count' in result, "Missing 'face_count'"
        assert 'person_count' in result, "Missing 'person_count'"
        print(f"  {test_color(True)} Ready: {detector.is_ready()}")
        print(f"  {test_color(True)} Faces: {result['face_count']}, Persons: {result['person_count']}")
        results['person_detection'] = True
    except Exception as e:
        print(f"  {test_color(False)} FAILED: {e}")
        results['person_detection'] = False

    # 3. HeadPoseEstimator
    print("\n[3/5] Testing HeadPoseEstimator...")
    try:
        from head_pose import HeadPoseEstimator
        estimator = HeadPoseEstimator()
        result = estimator.analyze(dummy_frame)
        assert isinstance(result, dict), "Expected dict result"
        assert 'yaw' in result, "Missing 'yaw'"
        assert 'flagged' in result, "Missing 'flagged'"
        print(f"  {test_color(True)} Ready: {estimator.is_ready()}")
        print(f"  {test_color(True)} Yaw: {result['yaw']}, Flagged: {result['flagged']}")
        results['head_pose'] = True
    except Exception as e:
        print(f"  {test_color(False)} FAILED: {e}")
        results['head_pose'] = False

    # 4. AudioAnalyzer
    print("\n[4/5] Testing AudioAnalyzer...")
    try:
        from audio_analysis import AudioAnalyzer
        analyzer = AudioAnalyzer()
        # Pass empty bytes (silence)
        result = analyzer.analyze(b'')
        assert isinstance(result, dict), "Expected dict result"
        print(f"  {test_color(True)} Ready: {analyzer.is_ready()}")
        print(f"  {test_color(True)} Voice Activity: {result.get('voice_activity', False)}")
        results['audio_analysis'] = True
    except Exception as e:
        print(f"  {test_color(False)} FAILED: {e}")
        results['audio_analysis'] = False

    # 5. SuspicionScorer
    print("\n[5/5] Testing SuspicionScorer...")
    try:
        from scoring import SuspicionScorer
        scorer = SuspicionScorer()
        r1 = scorer.add_event('test-session', 'gaze_away')
        r2 = scorer.add_event('test-session', 'multiple_faces')
        r3 = scorer.add_event('test-session', 'extra_voice')
        score_data = scorer.get_score('test-session')
        prob = scorer.get_cheating_probability('test-session')
        assert score_data['score'] == 2 + 5 + 3, f"Expected 10, got {score_data['score']}"
        assert score_data['risk_level'] == 'low', f"Expected low, got {score_data['risk_level']}"
        print(f"  {test_color(True)} Score after 3 events: {score_data['score']}")
        print(f"  {test_color(True)} Risk level: {score_data['risk_level']}")
        print(f"  {test_color(True)} Cheating probability: {prob}")
        results['scoring'] = True
    except Exception as e:
        print(f"  {test_color(False)} FAILED: {e}")
        results['scoring'] = False

    # Summary
    print("\n" + "=" * 50)
    passed = sum(results.values())
    total  = len(results)
    print(f"Results: {passed}/{total} modules OK")
    for name, ok in results.items():
        print(f"  {test_color(ok)} {name}")

    if passed < total:
        print("\nSome modules failed. Check that requirements.txt is fully installed.")
        sys.exit(1)
    else:
        print("\nAll AI modules operational. ✓")
        sys.exit(0)

if __name__ == '__main__':
    run_tests()
