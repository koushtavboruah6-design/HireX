/**
 * components/EventLog.jsx
 * Detailed paginated event log used in the Report page and Dashboard.
 */
import React, { useState } from 'react';
import { format } from 'date-fns';
import { ALERT_LABELS, ALERT_WEIGHTS, getRiskColors } from '../utils/helpers';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

const PAGE_SIZE = 20;

function SeverityDot({ severity }) {
  const colors = {
    high: 'bg-ink-900',
    medium: 'bg-ink-500',
    low: 'bg-ink-300',
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[severity] || colors.low} shadow-sm`}
    />
  );
}

export default function EventLog({ events = [], title = 'Event Log' }) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState('all');

  const types = ['all', ...new Set(events.map((e) => e.type))];

  const filtered = filter === 'all'
    ? events
    : events.filter((e) => e.type === filter);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3 panel p-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-white border border-paper-200">
      {/* Header + filter */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
        <h3 className="text-lg font-bold text-ink-900 flex items-center gap-2">
          <AlertTriangle size={18} className="text-ink-600" />
          {title} <span className="text-sm font-medium text-ink-500 ml-1 bg-paper-100 px-2.5 py-0.5 rounded-full border border-paper-200">({filtered.length})</span>
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          {types.slice(0, 6).map((t) => (
            <button
              key={t}
              onClick={() => { setFilter(t); setPage(0); }}
              className={`text-sm font-medium px-3.5 py-1.5 rounded-full transition-all duration-200 ${filter === t
                ? 'bg-ink-900 border border-ink-900 text-white shadow-sm hover:bg-ink-800'
                : 'bg-white border border-paper-200 text-ink-600 hover:border-ink-400 hover:text-ink-900 hover:bg-paper-50 shadow-sm'
                }`}
            >
              {t === 'all' ? 'All Events' : (ALERT_LABELS[t] || t)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-paper-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-paper-50 border-b border-paper-200">
            <tr>
              <th className="text-left font-semibold text-ink-600 py-3 px-4 w-12 rounded-tl-xl">#</th>
              <th className="text-left font-semibold text-ink-600 py-3 pr-4 w-32">Time</th>
              <th className="text-left font-semibold text-ink-600 py-3 pr-4">Type</th>
              <th className="text-left font-semibold text-ink-600 py-3 pr-4 w-24">Severity</th>
              <th className="text-left font-semibold text-ink-600 py-3 pr-4 w-16">Pts</th>
              <th className="text-left font-semibold text-ink-600 py-3 px-4 rounded-tr-xl">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-paper-100">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-ink-500 text-sm bg-white">
                  No events found matching the criteria.
                </td>
              </tr>
            ) : (
              paged.map((event, i) => {
                const idx = page * PAGE_SIZE + i + 1;
                return (
                  <tr
                    key={`${event.timestamp}-${i}`}
                    className="bg-white hover:bg-paper-50 transition-colors duration-200 group animate-fade-in"
                    style={{ animationDelay: `${i * 20}ms` }}
                  >
                    <td className="py-3 px-4 text-ink-400 font-medium group-hover:text-ink-600 transition-colors">{idx}</td>
                    <td className="py-3 pr-4 text-ink-600 tabular-nums">
                      {event.timestamp
                        ? format(new Date(event.timestamp), 'HH:mm:ss')
                        : '--:--:--'}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <SeverityDot severity={event.severity} />
                        <span className="font-semibold text-ink-800">
                          {ALERT_LABELS[event.type] || event.type}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded-md border ${event.severity === 'high' ? 'bg-ink-900 border-ink-900 text-white' :
                        event.severity === 'medium' ? 'bg-paper-200 border-paper-300 text-ink-800' :
                          'bg-paper-100 border-paper-200 text-ink-600'
                        }`}>
                        {(event.severity || 'med').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-ink-500 font-bold">
                      +{ALERT_WEIGHTS[event.type] || 1}
                    </td>
                    <td className="py-3 px-4 text-ink-600 max-w-xs truncate">
                      {event.message}
                      {event.metadata?.transcript && (
                        <span className="ml-2 text-ink-500 italic bg-paper-50 px-2 py-0.5 rounded text-xs border border-paper-100">
                          "{event.metadata.transcript.slice(0, 40)}..."
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-paper-200">
          <span className="text-sm font-medium text-ink-500 bg-white px-3 py-1 rounded-full border border-paper-200 shadow-sm">
            Page <span className="font-bold text-ink-900">{page + 1}</span> of <span className="font-bold text-ink-900">{totalPages}</span>
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="p-2 rounded-lg border border-paper-200 bg-white text-ink-700 shadow-sm disabled:opacity-40 disabled:hover:bg-white hover:bg-paper-50 hover:text-ink-900 hover:border-ink-300 transition-all duration-200"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="p-2 rounded-lg border border-paper-200 bg-white text-ink-700 shadow-sm disabled:opacity-40 disabled:hover:bg-white hover:bg-paper-50 hover:text-ink-900 hover:border-ink-300 transition-all duration-200"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
