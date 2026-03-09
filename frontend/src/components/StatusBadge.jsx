/**
 * components/StatusBadge.jsx
 * Reusable badge for risk level, session status, and severity indicators.
 */
import React from 'react';
import { Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const CONFIGS = {
  // Risk levels
  low: { label: 'LOW RISK', icon: CheckCircle, cls: 'bg-paper-100 text-ink-700 border-paper-200 shadow-sm hover:shadow-subtle hover:bg-white' },
  medium: { label: 'MEDIUM RISK', icon: AlertTriangle, cls: 'bg-paper-200 text-ink-800 border-paper-300 shadow-sm hover:shadow-subtle hover:bg-paper-100' },
  high: { label: 'HIGH RISK', icon: AlertTriangle, cls: 'bg-ink-900 text-white border-ink-900 shadow-sm hover:shadow-subtle hover:bg-ink-800' },

  // Session statuses
  active: { label: 'ACTIVE', icon: Shield, cls: 'bg-ink-900 text-white border-ink-900 shadow-sm hover:bg-ink-800' },
  ended: { label: 'ENDED', icon: Clock, cls: 'bg-paper-100 text-ink-500 border-paper-200 shadow-sm hover:bg-white' },
  waiting: { label: 'WAITING', icon: Clock, cls: 'bg-white text-ink-700 border-paper-300 shadow-sm hover:bg-paper-50' },
  flagged: { label: 'FLAGGED', icon: AlertTriangle, cls: 'bg-ink-900 text-white border-ink-900 shadow-sm hover:-translate-y-0.5 transition-transform' },
};

export default function StatusBadge({ type = 'low', showIcon = true, className = '' }) {
  const cfg = CONFIGS[type] || CONFIGS.low;
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold tracking-widest border transition-all duration-300 ${cfg.cls} ${className}`}
    >
      {showIcon && <Icon size={12} />}
      {cfg.label}
    </span>
  );
}
