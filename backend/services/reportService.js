/**
 * services/reportService.js
 * Server-side PDF report generation using PDFKit.
 */
const PDFDocument = require('pdfkit');
const { format } = require('date-fns');

/**
 * Generates a PDF buffer for a session report.
 * @param {Object} session - Session document
 * @param {Array} alerts - Array of alert documents
 * @returns {Promise<Buffer>}
 */
async function generatePDFReport(session, alerts) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `HIREX Report — ${session.candidateName}`,
          Author: 'HIREX System',
          Subject: 'Interview Integrity Report',
        },
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const DARK = '#04060f';
      const CYAN = '#06b6d4';
      const WHITE = '#ffffff';
      const SLATE = '#64748b';
      const RED = '#ef4444';
      const AMBER = '#f59e0b';
      const GREEN = '#10b981';
      const W = doc.page.width - 100;

      // ── Header ──────────────────────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 80).fill(DARK);
      doc.fillColor(CYAN).fontSize(22).font('Helvetica-Bold')
        .text('HIREX', 50, 25);
      doc.fillColor(WHITE).fontSize(13)
        .text('Interview Integrity Report', 50, 50);
      doc.fillColor(SLATE).fontSize(9)
        .text(`Generated: ${format(new Date(), 'PPpp')}`, 50, 68);

      // Right side: risk badge
      const riskColor = session.riskLevel === 'high' ? RED :
        session.riskLevel === 'medium' ? AMBER : GREEN;
      doc.fillColor(riskColor).fontSize(16).font('Helvetica-Bold')
        .text(`${(session.riskLevel || 'LOW').toUpperCase()} RISK`, 400, 30, { width: 150, align: 'right' });
      doc.fillColor(riskColor).fontSize(24)
        .text(`${session.suspicionScore}/100`, 400, 48, { width: 150, align: 'right' });

      doc.y = 100;

      // ── Candidate Info ───────────────────────────────────────────────────
      sectionHeader(doc, 'Candidate Information', CYAN);

      const info = [
        ['Candidate Name', session.candidateName],
        ['Email', session.candidateEmail],
        ['Session ID', session._id],
        ['Start Time', session.startTime ? format(new Date(session.startTime), 'PPpp') : 'N/A'],
        ['End Time', session.endTime ? format(new Date(session.endTime), 'PPpp') : 'N/A'],
        ['Duration', session.durationMinutes ? `${session.durationMinutes} minutes` : 'N/A'],
        ['Frames Analyzed', (session.framesAnalyzed || 0).toLocaleString()],
      ];

      info.forEach(([label, value]) => {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(SLATE)
          .text(label.toUpperCase(), 50, doc.y, { width: 140 });
        doc.font('Helvetica').fontSize(9).fillColor(WHITE)
          .text(value || '—', 200, doc.y - 10, { width: W - 140 });
        doc.moveDown(0.4);
      });

      // ── Risk Verdict ──────────────────────────────────────────────────────
      doc.moveDown();
      sectionHeader(doc, 'AI Integrity Assessment', CYAN);

      const verdictBg = session.riskLevel === 'high' ? '#1f0a0a' :
        session.riskLevel === 'medium' ? '#1a1400' : '#0a1a0f';

      doc.rect(50, doc.y, W, 50).fill(verdictBg);
      doc.fillColor(riskColor).font('Helvetica-Bold').fontSize(12)
        .text(`${(session.riskLevel || 'LOW').toUpperCase()} RISK — Score: ${session.suspicionScore}/100`, 60, doc.y - 45);
      doc.fillColor(SLATE).font('Helvetica').fontSize(9)
        .text(session.aiVerdict || 'No verdict generated.', 60, doc.y - 28, { width: W - 20 });

      doc.y += 15;

      // ── Anomaly Summary ───────────────────────────────────────────────────
      doc.moveDown();
      sectionHeader(doc, 'Anomaly Summary', CYAN);

      const counts = session.anomalyCounts || {};
      const summaryItems = [
        { label: 'Gaze Away', count: counts.gazeAway || 0, color: AMBER },
        { label: 'Multiple Faces', count: counts.multipleFaces || 0, color: RED },
        { label: 'Audio Anomalies', count: counts.audioAnomalies || 0, color: AMBER },
        { label: 'Tab Switches', count: counts.tabSwitches || 0, color: AMBER },
        { label: 'Body Intrusions', count: counts.bodyIntrusions || 0, color: RED },
        { label: 'Phone Detected', count: counts.phoneDetected || 0, color: RED },
      ];

      const colW = W / 3;
      let col = 0;
      let rowY = doc.y;

      summaryItems.forEach(({ label, count, color }) => {
        const x = 50 + col * colW;
        doc.rect(x, rowY, colW - 6, 36).fill('#0a1628');
        doc.fillColor(color).font('Helvetica-Bold').fontSize(18)
          .text(count.toString(), x + 10, rowY + 4, { width: colW - 20 });
        doc.fillColor(SLATE).font('Helvetica').fontSize(8)
          .text(label, x + 10, rowY + 22, { width: colW - 20 });

        col++;
        if (col >= 3) { col = 0; rowY += 44; }
      });

      doc.y = rowY + 50;

      // ── Event Log ─────────────────────────────────────────────────────────
      if (alerts.length > 0) {
        sectionHeader(doc, `Detected Events (${alerts.length})`, CYAN);

        // Table header
        const cols = [
          { label: '#', x: 50, w: 25 },
          { label: 'TIME', x: 75, w: 55 },
          { label: 'TYPE', x: 130, w: 110 },
          { label: 'SEVERITY', x: 240, w: 60 },
          { label: 'DETAILS', x: 300, w: W - 250 },
        ];

        doc.rect(50, doc.y, W, 16).fill('#0a1628');
        cols.forEach(({ label, x }) => {
          doc.fillColor(CYAN).font('Helvetica-Bold').fontSize(7)
            .text(label, x + 2, doc.y - 14);
        });
        doc.y += 4;

        alerts.slice(0, 100).forEach((alert, i) => {
          if (doc.y > 750) {
            doc.addPage();
            doc.y = 50;
          }

          const bg = i % 2 === 0 ? '#060c1a' : '#04060f';
          doc.rect(50, doc.y, W, 14).fill(bg);

          const sevColor = alert.severity === 'high' ? RED :
            alert.severity === 'medium' ? AMBER : CYAN;

          const ts = alert.timestamp
            ? format(new Date(alert.timestamp), 'HH:mm:ss')
            : '--:--:--';

          doc.fillColor(SLATE).font('Helvetica').fontSize(7)
            .text((i + 1).toString(), 52, doc.y - 12);
          doc.fillColor(SLATE).text(ts, 77, doc.y - 12);
          doc.fillColor(WHITE).font('Helvetica-Bold')
            .text((alert.type || '').replace(/_/g, ' ').toUpperCase(), 132, doc.y - 12, { width: 106 });
          doc.fillColor(sevColor).font('Helvetica').fontSize(7)
            .text((alert.severity || '').toUpperCase(), 242, doc.y - 12, { width: 56 });
          doc.fillColor(SLATE)
            .text(alert.message || '', 302, doc.y - 12, { width: W - 255, ellipsis: true });

          doc.y += 2;
        });

        if (alerts.length > 100) {
          doc.moveDown(0.5);
          doc.fillColor(SLATE).font('Helvetica').fontSize(8)
            .text(`... and ${alerts.length - 100} more events (truncated for brevity)`, 50, doc.y);
        }
      }

      // ── Footer ───────────────────────────────────────────────────────────
      doc.moveDown(2);
      doc.rect(50, doc.y, W, 1).fill('#0f2040');
      doc.moveDown(0.5);
      doc.fillColor(SLATE).font('Helvetica').fontSize(7)
        .text(
          'This report was generated automatically by HIREX. ' +
          'All findings should be verified by a qualified human assessor before taking action.',
          50, doc.y, { width: W, align: 'center' }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function sectionHeader(doc, title, color) {
  doc.fillColor(color).font('Helvetica-Bold').fontSize(11)
    .text(title, 50, doc.y);
  doc.rect(50, doc.y + 2, doc.page.width - 100, 1).fill('#142952');
  doc.moveDown(0.8);
}

module.exports = { generatePDFReport };
