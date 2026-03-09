/**
 * hooks/useTabDetection.js
 * Monitors tab switches, window blur, fullscreen exit,
 * and keyboard shortcuts that might indicate cheating.
 */
import { useEffect, useRef, useCallback } from 'react';

export function useTabDetection({ sessionId, onViolation, enabled = true }) {
  const tabSwitchCount = useRef(0);
  const blurCount = useRef(0);
  const lastViolationTime = useRef(0);

  // Debounce: don't fire the same violation type more than once per 3s
  const shouldFire = useCallback(() => {
    const now = Date.now();
    if (now - lastViolationTime.current > 3000) {
      lastViolationTime.current = now;
      return true;
    }
    return false;
  }, []);

  const fireViolation = useCallback((type, message, metadata = {}) => {
    if (!enabled) return;
    onViolation?.({
      type,
      severity: 'medium',
      message,
      timestamp: new Date().toISOString(),
      metadata: { sessionId, ...metadata },
    });
  }, [enabled, onViolation, sessionId]);

  useEffect(() => {
    if (!enabled) return;

    // Tab / document visibility change
    const handleVisibility = () => {
      if (document.hidden) {
        tabSwitchCount.current++;
        fireViolation(
          'tab_switch',
          `Tab switch detected (count: ${tabSwitchCount.current})`,
          { count: tabSwitchCount.current }
        );
      }
    };

    // Window blur (alt-tab, click outside browser)
    const handleBlur = () => {
      if (!shouldFire()) return;
      blurCount.current++;
      fireViolation(
        'tab_switch',
        'Browser window lost focus',
        { blurCount: blurCount.current }
      );
    };

    // Block right-click
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    // Detect PrintScreen or suspicious key combos
    const handleKeyDown = (e) => {
      const suspicious =
        e.key === 'PrintScreen' ||
        (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) ||
        (e.metaKey && e.shiftKey && e.key.toLowerCase() === 's');

      if (suspicious && shouldFire()) {
        fireViolation(
          'tab_switch',
          `Suspicious key combination: ${e.ctrlKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`,
          { key: e.key }
        );
      }
    };

    // Fullscreen exit detection
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && shouldFire()) {
        fireViolation('tab_switch', 'Fullscreen mode exited');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [enabled, fireViolation, shouldFire]);

  return {
    tabSwitchCount: tabSwitchCount.current,
    blurCount: blurCount.current,
  };
}
