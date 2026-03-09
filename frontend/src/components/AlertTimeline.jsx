/**
 * AlertTimeline.jsx
 * Live scrolling feed of detected anomalies with severity classification.
 */
import React, { useRef, useEffect } from 'react';
import { AlertTriangle, Eye, Users, Mic, Monitor, User, Camera } from 'lucide-react';
import { format } from 'date-fns';

const ALERT_CONFIG = {
  gaze_away: { icon: Eye, label: 'Gaze Away', color: 'amber', weight: 2 },
  multiple_faces: { icon: Users, label: 'Multiple Persons', color: 'red', weight: 5 },
  extra_voice: { icon: Mic, label: 'Extra Voice', color: 'amber', weight: 3 },
  body_intrusion: { icon: User, label: 'Body Intrusion', color: 'red', weight: 4 },
  tab_switch: { icon: Monitor, label: 'Tab Switch', color: 'amber', weight: 3 },
  head_pose: { icon: Eye, label: 'Head Turned', color: 'amber', weight: 2 },
  no_face: { icon: Camera, label: 'Face Not Detected', color: 'red', weight: 4 },
  suspicious_audio: { icon: Mic, label: 'Suspicious Audio', color: 'amber', weight: 3 },
  phone_detected: { icon: Camera, label: 'Phone Detected', color: 'red', weight: 5 },
};

const colorMap = {
  red: { bg: 'bg-paper-100 hover:bg-paper-200', border: 'border-ink-200 hover:border-ink-300', text: 'text-ink-900', dot: 'bg-ink-900', iconBg: 'bg-paper-200 text-ink-900' },
  amber: { bg: 'bg-paper-50 hover:bg-paper-100', border: 'border-paper-200 hover:border-paper-300', text: 'text-ink-700', dot: 'bg-ink-700', iconBg: 'bg-paper-100 text-ink-700' },
  cyan: { bg: 'bg-white hover:bg-paper-50', border: 'border-paper-200 hover:border-paper-300', text: 'text-ink-500', dot: 'bg-ink-500', iconBg: 'bg-paper-50 text-ink-500' },
};

function AlertRow({ alert, index }) {
  const cfg = ALERT_CONFIG[alert.type] || {
    icon: AlertTriangle, label: alert.type, color: 'cyan', weight: 1,
  };
  const { icon: Icon, label, color, weight } = cfg;
  const c = colorMap[color] || colorMap.cyan;

  const ts = alert.timestamp
    ? format(new Date(alert.timestamp), 'HH:mm:ss')
    : '--:--:--';

  return (
    <div
      className={`flex items-start gap-3 p-3.5 rounded-xl border ${c.bg} ${c.border} animate-slide-up transition-all duration-300 shadow-sm hover:shadow-subtle`}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className={`mt-0.5 p-2 rounded-lg ${c.iconBg} shadow-sm`}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className={`text-sm font-semibold tracking-tight ${c.text}`}>{label}</span>
          <span className="text-ink-500 text-xs font-medium shrink-0 bg-paper-100 px-2 py-0.5 rounded-full">{ts}</span>
        </div>
        <p className="text-sm text-ink-600 leading-snug truncate">{alert.message}</p>
        {alert.metadata?.transcript && (
          <p className="text-xs text-ink-500 mt-1.5 italic truncate bg-paper-50 p-2 rounded-md border border-paper-200">
            "{alert.metadata.transcript}"
          </p>
        )}
      </div>
      <div
        className={`shrink-0 text-xs font-bold px-2 py-1 rounded-md bg-white border ${c.border} text-ink-900 shadow-sm`}
        title="Weight added to score"
      >
        +{weight}
      </div>
    </div>
  );
}

export default function AlertTimeline({ alerts = [], maxVisible = 50 }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [alerts.length]);

  const visible = alerts.slice(0, maxVisible);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-ink-800 tracking-wide flex items-center gap-2">
          <AlertTriangle size={16} className="text-ink-600" /> Alert Timeline
        </p>
        <div className="flex items-center gap-3 bg-paper-50 px-3 py-1.5 rounded-full border border-paper-200 shadow-sm">
          <span className="text-xs font-medium text-ink-600">{alerts.length} total</span>
          {alerts.length > 0 && (
            <span className="text-xs font-bold text-ink-900 flex items-center gap-1.5">
              <span className="live-dot" style={{ width: 8, height: 8 }} />
              LIVE
            </span>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2 pr-1"
        style={{ maxHeight: '420px' }}
      >
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center bg-paper-50 rounded-xl border border-dashed border-paper-300 m-1">
            <div className="w-12 h-12 rounded-full bg-white shadow-sm border border-paper-200 flex items-center justify-center mb-4 animate-scale-in">
              <AlertTriangle size={20} className="text-ink-400" />
            </div>
            <p className="text-sm font-semibold tracking-wide text-ink-600">NO ALERTS YET</p>
            <p className="text-sm text-ink-400 mt-1">Monitoring in progress...</p>
          </div>
        ) : (
          visible.map((alert, i) => (
            <AlertRow
              key={alert.id || `${alert.timestamp}-${i}`}
              alert={alert}
              index={i}
            />
          ))
        )}
      </div>
    </div>
  );
}
