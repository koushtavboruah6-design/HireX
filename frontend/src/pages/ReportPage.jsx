/**
 * ReportPage.jsx
 * Displays the final interview integrity report with PDF export capability.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Shield, AlertTriangle, CheckCircle, Eye, Users, Mic,
  Download, ArrowLeft, Clock, Calendar, TrendingUp, FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const VERDICT_CONFIG = {
  low: {
    label: 'LOW RISK',
    sub: 'Interview appears legitimate. No significant anomalies detected.',
    color: '#0a0a0a', // ink-900
    glow: 'rgba(0,0,0,0.05)',
    bg: 'bg-paper-50',
    border: 'border-paper-200',
    icon: CheckCircle,
  },
  medium: {
    label: 'MEDIUM RISK',
    sub: 'Some anomalies detected. Manual review recommended.',
    color: '#d97706', // amber-600
    glow: 'rgba(217,119,6,0.15)',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: AlertTriangle,
  },
  high: {
    label: 'HIGH RISK',
    sub: 'Multiple critical anomalies detected. This interview may have been compromised.',
    color: '#dc2626', // red-600
    glow: 'rgba(220,38,38,0.15)',
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: AlertTriangle,
  },
};

function ReportSection({ title, children }) {
  return (
    <div className="panel p-6 sm:p-8 bg-white border border-paper-200 shadow-[0_8px_30px_rgb(0,0,0,0.12)] animate-slide-up hover:-translate-y-1 transition-all duration-300">
      <h3 className="font-display font-bold text-ink-900 text-lg mb-5 flex items-center gap-3 border-b border-paper-100 pb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function EventRow({ event, index }) {
  const isHigh = event.severity === 'high';
  const isMed = event.severity === 'medium';
  return (
    <div
      className={`flex items-start sm:items-center gap-3 p-4 rounded-xl border text-sm transition-all hover:-translate-y-0.5 shadow-sm hover:shadow ${isHigh ? 'bg-red-50 border-red-200' :
        isMed ? 'bg-amber-50 border-amber-200' :
          'bg-paper-50 border-paper-200'
        }`}
    >
      <span className="font-bold text-ink-400 shrink-0 w-6 text-right font-display">{index + 1}.</span>
      <span className="font-bold text-ink-500 shrink-0 w-20">
        {event.timestamp ? format(new Date(event.timestamp), 'HH:mm:ss') : '--:--:--'}
      </span>
      <span className={`font-bold tracking-widest shrink-0 uppercase text-xs w-32 ${isHigh ? 'text-red-600' : isMed ? 'text-amber-600' : 'text-ink-900'
        }`}>
        {(event.type || 'UNKNOWN').replace(/_/g, ' ')}
      </span>
      <span className="text-ink-600 flex-1 font-medium">{event.message}</span>
    </div>
  );
}

export default function ReportPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/reports/${sessionId}`);
        setReport(res.data);
      } catch {
        // Demo report if backend unavailable
        setReport({
          sessionId,
          candidateName: 'Demo Candidate',
          candidateEmail: 'demo@example.com',
          startTime: new Date(Date.now() - 45 * 60000).toISOString(),
          endTime: new Date().toISOString(),
          durationMinutes: 45,
          suspicionScore: 28,
          riskLevel: 'medium',
          framesAnalyzed: 1800,
          events: [
            { type: 'gaze_away', severity: 'medium', message: 'Candidate looked away from screen (left)', timestamp: new Date(Date.now() - 40 * 60000).toISOString() },
            { type: 'tab_switch', severity: 'medium', message: 'Browser window lost focus', timestamp: new Date(Date.now() - 32 * 60000).toISOString() },
            { type: 'extra_voice', severity: 'medium', message: 'Additional voice detected in background', timestamp: new Date(Date.now() - 20 * 60000).toISOString() },
            { type: 'gaze_away', severity: 'low', message: 'Brief gaze deviation detected', timestamp: new Date(Date.now() - 10 * 60000).toISOString() },
          ],
          summary: {
            gazeAway: 3,
            multipleFaces: 0,
            audioAnomalies: 1,
            tabSwitches: 1,
            bodyIntrusions: 0,
          },
          aiVerdict: 'Some anomalies were detected during this session. The candidate showed signs of distraction (gaze deviations) and an additional voice was briefly detected. Manual review of the flagged timestamps is recommended.',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [sessionId]);

  const downloadPDF = () => {
    if (!report) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const MARGIN = 20;
    const W = 210 - MARGIN * 2;

    // Header
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 40, 'F');
    // Draw a subtle bottom border for header
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(0, 40, 210, 40);

    doc.setTextColor(10, 10, 10);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('HIREX Report', MARGIN, 22);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${format(new Date(), 'PPpp')}`, MARGIN, 32);

    let y = 55;

    // Candidate info
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(10, 10, 10);
    doc.text('Candidate Information', MARGIN, y);
    y += 8;

    const info = [
      ['Name', report.candidateName],
      ['Email', report.candidateEmail],
      ['Session ID', report.sessionId],
      ['Start Time', report.startTime ? format(new Date(report.startTime), 'PPpp') : 'N/A'],
      ['Duration', `${report.durationMinutes || 0} minutes`],
    ];

    doc.autoTable({
      startY: y,
      head: [],
      body: info,
      margin: { left: MARGIN, right: MARGIN },
      styles: { fontSize: 10, cellPadding: 4, textColor: [71, 85, 105], font: 'helvetica' },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40, textColor: [10, 10, 10] } },
      theme: 'plain',
    });
    y = doc.lastAutoTable.finalY + 15;

    // Risk verdict
    const verdict = VERDICT_CONFIG[report.riskLevel] || VERDICT_CONFIG.low;
    const riskRgb = report.riskLevel === 'high' ? [220, 38, 38] : report.riskLevel === 'medium' ? [217, 119, 6] : [10, 10, 10];
    const riskBgRgb = report.riskLevel === 'high' ? [254, 242, 242] : report.riskLevel === 'medium' ? [255, 251, 235] : [248, 250, 252];

    doc.setFillColor(...riskBgRgb);
    doc.roundedRect(MARGIN, y, W, 24, 4, 4, 'F');
    doc.setDrawColor(...riskRgb);
    doc.setLineWidth(0.5);
    doc.roundedRect(MARGIN, y, W, 24, 4, 4, 'S');
    doc.setTextColor(...riskRgb);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${verdict.label} — Score: ${report.suspicionScore}/100`, MARGIN + 6, y + 10);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(verdict.sub, MARGIN + 6, y + 18);
    y += 35;

    // Event log
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(10, 10, 10);
    doc.text('Detected Events', MARGIN, y);
    y += 6;

    if (report.events?.length > 0) {
      doc.autoTable({
        startY: y,
        head: [['#', 'Time', 'Type', 'Severity', 'Details']],
        body: report.events.map((e, i) => [
          i + 1,
          e.timestamp ? format(new Date(e.timestamp), 'HH:mm:ss') : '--',
          (e.type || '').replace(/_/g, ' ').toUpperCase(),
          (e.severity || '').toUpperCase(),
          e.message || '',
        ]),
        margin: { left: MARGIN, right: MARGIN },
        headStyles: { fillColor: [248, 250, 252], textColor: [10, 10, 10], fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: [71, 85, 105] },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        theme: 'grid',
        styles: { lineColor: [226, 232, 240], lineWidth: 0.1 }
      });
      y = doc.lastAutoTable.finalY + 15;
    }

    // AI Verdict
    if (report.aiVerdict) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(10, 10, 10);
      doc.text('AI Analysis Summary', MARGIN, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const lines = doc.splitTextToSize(report.aiVerdict, W);
      doc.text(lines, MARGIN, y);
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('This report was generated automatically by HIREX. All findings should be reviewed by a qualified assessor.', MARGIN, 285);

    doc.save(`HIREX_Report_${report.candidateName?.replace(/\s+/g, '_') || 'Session'}_${sessionId}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper-50 flex items-center justify-center font-body">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-paper-200 border-t-ink-900 rounded-full animate-spin mx-auto mb-6" />
          <p className="text-ink-600 font-bold tracking-widest text-sm animate-pulse-soft">GENERATING REPORT...</p>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const verdict = VERDICT_CONFIG[report.riskLevel] || VERDICT_CONFIG.low;
  const VerdictIcon = verdict.icon;
  const duration = report.durationMinutes
    ? `${Math.floor(report.durationMinutes / 60)}h ${report.durationMinutes % 60}m`
    : `${report.durationMinutes || 0}m`;

  return (
    <div className="min-h-screen bg-paper-50 font-body text-ink-900 pb-12">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-paper-200 bg-white/90 backdrop-blur-md sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-ink-500 hover:text-ink-900 transition-colors bg-paper-50 p-2 rounded-full border border-paper-200 hover:shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-8 h-8 bg-paper-100 rounded-lg flex items-center justify-center border border-paper-200 shadow-sm hidden md:flex">
            <Shield size={16} className="text-ink-800" />
          </div>
          <span className="font-display font-bold text-ink-900 text-lg">HIREX</span>
          <span className="text-ink-400 text-sm font-medium">/ Integrity Report</span>
        </div>
        <button
          onClick={downloadPDF}
          className="flex items-center gap-2 bg-ink-900 hover:bg-ink-800 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-sm hover:shadow-subtle hover:-translate-y-0.5 transition-all duration-300 tracking-wide"
        >
          <Download size={16} />
          DOWNLOAD PDF
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Verdict Banner */}
        <div
          className={`panel ${verdict.bg} ${verdict.border} p-8 flex flex-col md:flex-row items-center md:items-start gap-6 animate-slide-up shadow-sm`}
        >
          <div
            className={`w-20 h-20 rounded-2xl flex items-center justify-center bg-white border ${verdict.border} shrink-0 shadow-sm`}
            style={{ boxShadow: `0 8px 24px -4px ${verdict.glow}` }}
          >
            <VerdictIcon size={36} style={{ color: verdict.color }} />
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center gap-4 mb-2">
              <h2
                className="font-display font-black text-3xl md:text-4xl tracking-tight"
                style={{ color: verdict.color }}
              >
                {verdict.label}
              </h2>
              <span
                className="font-bold text-xl md:text-2xl px-4 py-1 rounded-full bg-white border shadow-sm"
                style={{ color: verdict.color, borderColor: verdict.color }}
              >
                {report.suspicionScore}/100
              </span>
            </div>
            <p className="text-ink-600 text-base md:text-lg font-medium">{verdict.sub}</p>
          </div>
        </div>

        {/* Candidate + session info */}
        <div className="grid md:grid-cols-2 gap-8">
          <ReportSection title="Candidate Details">
            <div className="space-y-4">
              {[
                { label: 'Name', value: report.candidateName },
                { label: 'Email', value: report.candidateEmail },
                { label: 'Session ID', value: report.sessionId, fontMono: true },
              ].map(({ label, value, fontMono }) => (
                <div key={label} className="flex justify-between items-center py-2.5 border-b border-paper-100 last:border-0 last:pb-0">
                  <span className="text-xs font-bold text-ink-500 uppercase tracking-widest">{label}</span>
                  <span className={`text-base font-medium text-ink-900 ${fontMono ? 'font-mono text-sm bg-paper-50 px-2 py-0.5 rounded border border-paper-200' : ''}`}>{value || '—'}</span>
                </div>
              ))}
            </div>
          </ReportSection>

          <ReportSection title="Session Timeline">
            <div className="space-y-4">
              {[
                { label: 'Start Time', value: report.startTime ? format(new Date(report.startTime), 'PPp') : '—', icon: Calendar },
                { label: 'End Time', value: report.endTime ? format(new Date(report.endTime), 'PPp') : '—', icon: Calendar },
                { label: 'Duration', value: duration, icon: Clock },
                { label: 'Frames Analyzed', value: (report.framesAnalyzed || 0).toLocaleString(), icon: Eye },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex justify-between items-center py-2.5 border-b border-paper-100 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-ink-400" />
                    <span className="text-xs font-bold text-ink-500 uppercase tracking-widest">{label}</span>
                  </div>
                  <span className="text-base font-bold text-ink-900">{value}</span>
                </div>
              ))}
            </div>
          </ReportSection>
        </div>

        {/* Event summary */}
        <ReportSection title="Anomaly Summary">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Gaze Away', value: report.summary?.gazeAway || 0, icon: Eye, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Multiple Faces', value: report.summary?.multipleFaces || 0, icon: Users, color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Audio Anomalies', value: report.summary?.audioAnomalies || 0, icon: Mic, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Tab Switches', value: report.summary?.tabSwitches || 0, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Body Intrusions', value: report.summary?.bodyIntrusions || 0, icon: Users, color: 'text-red-600', bg: 'bg-red-50' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="panel p-5 text-center bg-white border border-paper-200 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                <div className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center mx-auto mb-3`}>
                  <Icon size={20} className={color} />
                </div>
                <div className={`font-display font-black text-3xl tracking-tight mb-1 ${color}`}>{value}</div>
                <div className="text-xs font-bold text-ink-500 uppercase tracking-widest">{label}</div>
              </div>
            ))}
          </div>
        </ReportSection>

        {/* Event log */}
        {report.events?.length > 0 && (
          <ReportSection title={`Detected Events (${report.events.length})`}>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {report.events.map((event, i) => (
                <EventRow key={`${event.timestamp}-${i}`} event={event} index={i} />
              ))}
            </div>
          </ReportSection>
        )}

        {/* AI Verdict */}
        {report.aiVerdict && (
          <ReportSection title="AI Analysis Summary">
            <div className="bg-paper-50 rounded-2xl p-6 border border-paper-200 shadow-inner">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-paper-200 shrink-0 shadow-sm">
                  <FileText size={20} className="text-ink-800" />
                </div>
                <p className="text-base text-ink-700 leading-relaxed font-medium mt-1">{report.aiVerdict}</p>
              </div>
            </div>
            <p className="text-sm font-bold text-ink-400 mt-4 flex items-center gap-2 justify-end">
              <AlertTriangle size={14} />
              * This report was generated automatically. All findings should be reviewed by a qualified assessor.
            </p>
          </ReportSection>
        )}
      </div>

      {/* Watermark */}
      <div className="fixed bottom-4 right-6 pointer-events-none opacity-40 z-50">
        <p className="font-display font-bold text-ink-900 text-xs tracking-widest uppercase">builded by team Code Tandoor</p>
      </div>
    </div>
  );
}
