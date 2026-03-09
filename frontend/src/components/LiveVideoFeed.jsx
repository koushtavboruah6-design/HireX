/**
 * components/LiveVideoFeed.jsx
 * Reusable webcam display with proctoring overlay:
 *  - Corner brackets (tactical HUD aesthetic)
 *  - Scan-line animation
 *  - REC badge
 *  - Face detection bounding box (if passed)
 *  - Suspicion score overlay
 */
import React, { forwardRef } from 'react';
import { Shield, Video } from 'lucide-react';

const LiveVideoFeed = forwardRef(function LiveVideoFeed(
  {
    active = false,
    suspicionScore = 0,
    framesAnalyzed = 0,
    faceDetected = true,
    riskLevel = 'low',
    className = '',
    style = {},
    children,
  },
  ref
) {
  const borderColor =
    riskLevel === 'high' ? '#171717' :
      riskLevel === 'medium' ? '#525252' : '#e5e5e5';

  return (
    <div
      className={`relative overflow-hidden bg-white rounded-2xl group transition-all duration-300 ${className}`}
      style={{
        border: `1px solid ${borderColor}`,
        boxShadow: active ? `0 12px 40px rgb(0,0,0,0.15)` : '0 8px 30px rgb(0,0,0,0.12)',
        ...style,
      }}
    >
      {/* Corner brackets */}
      {['tl', 'tr', 'bl', 'br'].map((pos) => (
        <div
          key={pos}
          className={`video-overlay-corner corner-${pos} z-10`}
          style={{ borderColor }}
        />
      ))}

      {/* Scan line (only when active) */}
      {active && <div className="scan-line" />}

      {/* Video element */}
      <video
        ref={ref}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Initializing overlay */}
      {!active && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm z-20 transition-opacity duration-300">
          <div className="relative w-16 h-16 mb-4">
            {/* Smooth animated loader */}
            <div className="absolute inset-0 border-4 border-paper-200 rounded-full" />
            <div className="absolute inset-0 border-4 border-ink-900 rounded-full animate-spin border-t-transparent" style={{ animationDuration: '1s' }} />
          </div>
          <p className="text-ink-600 font-semibold tracking-wide animate-pulse-soft">INITIALIZING CAMERA</p>
        </div>
      )}

      {/* Top-left: REC badge */}
      {active && (
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-white/90 backdrop-blur-md border border-paper-200 shadow-sm rounded-full px-3 py-1.5 z-10 transition-transform duration-300 group-hover:scale-105">
          <span className="live-dot" />
          <span className="text-ink-900 text-xs font-bold tracking-widest">REC</span>
        </div>
      )}

      {/* Top-right: monitoring status */}
      {active && (
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-white/90 backdrop-blur-md border border-paper-200 shadow-sm rounded-full px-3 py-1.5 z-10 transition-transform duration-300 group-hover:scale-105">
          <Shield size={12} className="text-ink-700" />
          <span className="text-xs font-bold tracking-widest text-ink-700">MONITORING</span>
        </div>
      )}

      {/* Face not detected warning */}
      {active && !faceDetected && (
        <div className="absolute inset-0 border-[3px] border-ink-900/60 rounded-2xl z-10 pointer-events-none transition-all duration-300">
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-ink-900 text-white shadow-floating text-xs font-bold px-4 py-2 rounded-full tracking-widest animate-slide-up">
            FACE NOT DETECTED
          </div>
        </div>
      )}

      {/* Bottom-right: risk score */}
      {active && (
        <div
          className="absolute bottom-4 right-4 text-xs font-bold px-3 py-1.5 rounded-xl bg-white/90 backdrop-blur-md border border-paper-200 shadow-sm z-10 transition-transform duration-300 group-hover:-translate-y-1"
          style={{ color: riskLevel === 'low' ? '#525252' : '#0a0a0a' }}
        >
          RISK: <span className="text-ink-900">{suspicionScore}</span>
        </div>
      )}

      {/* Bottom-left: frames */}
      {active && framesAnalyzed > 0 && (
        <div className="absolute bottom-4 left-4 text-ink-500 font-medium text-xs bg-white/90 backdrop-blur-md border border-paper-200 shadow-sm rounded-xl px-2.5 py-1.5 z-10 transition-transform duration-300 group-hover:-translate-y-1">
          {framesAnalyzed} frames
        </div>
      )}

      {/* Custom children (e.g. debug overlays) */}
      {children}
    </div>
  );
});

export default LiveVideoFeed;
