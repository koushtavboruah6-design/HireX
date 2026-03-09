/**
 * SuspicionMeter.jsx
 * Animated circular gauge displaying real-time suspicion score.
 */
import React, { useEffect, useRef } from 'react';

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getRiskLevel(score) {
  if (score < 20) return { label: 'LOW RISK', color: '#171717', glow: 'rgba(0,0,0,0.05)', bg: '#f5f5f5' };
  if (score < 50) return { label: 'MEDIUM RISK', color: '#525252', glow: 'rgba(0,0,0,0.1)', bg: '#e5e5e5' };
  return { label: 'HIGH RISK', color: '#0a0a0a', glow: 'rgba(0,0,0,0.2)', bg: '#e5e5e5' };
}

export default function SuspicionMeter({ score = 0, maxScore = 100, size = 160 }) {
  const normalized = Math.min(score / maxScore, 1);
  const offset = CIRCUMFERENCE * (1 - normalized);
  const risk = getRiskLevel(score);
  const prevScoreRef = useRef(score);

  useEffect(() => {
    prevScoreRef.current = score;
  }, [score]);

  return (
    <div className="flex flex-col items-center group">
      <div className="relative transition-transform duration-500 group-hover:scale-105" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 128 128" className="-rotate-90">
          {/* Background track */}
          <circle
            cx="64" cy="64" r={RADIUS}
            fill="none"
            stroke="#f5f5f5"
            strokeWidth="10"
          />
          {/* Score arc */}
          <circle
            cx="64" cy="64" r={RADIUS}
            fill="none"
            stroke={risk.color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s ease',
              filter: `drop-shadow(0 0 8px ${risk.glow})`,
            }}
          />
          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = (tick / 100) * 2 * Math.PI - Math.PI / 2;
            const innerR = RADIUS - 7;
            const outerR = RADIUS + 4;
            return (
              <line
                key={tick}
                x1={64 + innerR * Math.cos(angle)}
                y1={64 + innerR * Math.sin(angle)}
                x2={64 + outerR * Math.cos(angle)}
                y2={64 + outerR * Math.sin(angle)}
                stroke="#e5e5e5"
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-display font-black text-4xl leading-none transition-all duration-500 text-ink-900 drop-shadow-sm"
          >
            {score}
          </span>
          <span className="text-ink-500 font-medium text-xs mt-1 bg-paper-100 px-2 rounded-full border border-paper-200">/ {maxScore}</span>
        </div>
      </div>

      {/* Risk label */}
      <div
        className="mt-4 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest border transition-all duration-300 shadow-sm group-hover:shadow-md"
        style={{
          color: risk.color === '#0a0a0a' ? '#ffffff' : risk.color,
          borderColor: risk.color === '#0a0a0a' ? '#0a0a0a' : `${risk.color}40`,
          backgroundColor: risk.color === '#0a0a0a' ? '#0a0a0a' : risk.bg,
        }}
      >
        {risk.label}
      </div>

      {/* Sub-score breakdown */}
      <div className="mt-5 w-full space-y-2.5 text-xs font-medium">
        {[
          { label: 'GAZE', pct: Math.min(score * 0.3, 30), max: 30, color: '#404040' },
          { label: 'PERSON', pct: Math.min(score * 0.4, 40), max: 40, color: '#171717' },
          { label: 'AUDIO', pct: Math.min(score * 0.3, 30), max: 30, color: '#737373' },
        ].map(({ label, pct, max, color }) => (
          <div key={label} className="flex items-center gap-3 group/bar">
            <span className="text-ink-500 font-bold tracking-wide w-14 text-right">{label}</span>
            <div className="flex-1 h-2 bg-paper-100 rounded-full overflow-hidden border border-paper-200">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${(pct / max) * 100}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-ink-700 font-bold w-6">{Math.round(pct)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
