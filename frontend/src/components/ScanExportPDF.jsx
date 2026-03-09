import React, { useState } from 'react';
import { Download, X, Printer, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * Scan Export to PDF
 *
 * Generates a formatted single-page PDF of the scan result —
 * patient name, date, drugs, interactions found, pharmacist
 * acknowledgment.  Creates a paper trail suitable for the patient
 * file and the MFDS retrospective trial dataset.
 *
 * Uses a popup window with dedicated print HTML so the layout is
 * completely independent from the screen UI.
 */

function buildPrintHTML({ results, patientInfo, drugs, species }) {
  const { interactions, drugFlags, confidenceScore, timestamp } = results;
  const dateStr = new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const criticalCount = interactions.filter(i => i.severity?.label === 'Critical').length;
  const moderateCount = interactions.filter(i => i.severity?.label === 'Moderate').length;
  const minorCount = interactions.filter(
    i => i.severity?.label === 'Minor' || i.severity?.label === 'Unknown'
  ).length;

  const severityColor = (label) => {
    if (label === 'Critical') return '#dc2626';
    if (label === 'Moderate') return '#d97706';
    return '#64748b';
  };

  const interactionRows = interactions.map((ix) => `
    <tr>
      <td style="padding:8px 10px; border-bottom:1px solid #f1f5f9; font-weight:600; color:${severityColor(ix.severity?.label)}">
        ${ix.severity?.label ?? 'Unknown'}
      </td>
      <td style="padding:8px 10px; border-bottom:1px solid #f1f5f9; font-weight:500; color:#0f172a">
        ${ix.drugA} + ${ix.drugB}
      </td>
      <td style="padding:8px 10px; border-bottom:1px solid #f1f5f9; color:#475569; font-size:11px">
        ${ix.rule ?? ''}
      </td>
      <td style="padding:8px 10px; border-bottom:1px solid #f1f5f9; color:#475569; font-size:11px; max-width:200px">
        ${typeof ix.recommendation === 'string' ? ix.recommendation.slice(0, 120) + (ix.recommendation.length > 120 ? '...' : '') : ''}
      </td>
    </tr>
  `).join('');

  const drugRows = drugFlags.map((df) => `
    <tr>
      <td style="padding:6px 10px; border-bottom:1px solid #f8fafc; font-weight:500; color:#334155">${df.drugName}</td>
      <td style="padding:6px 10px; border-bottom:1px solid #f8fafc; color:#64748b; font-size:11px">
        ${df.flags.map(f => f.label).join(', ') || '—'}
      </td>
      <td style="padding:6px 10px; border-bottom:1px solid #f8fafc; color:#64748b; font-size:11px">
        ${df.hasSpeciesWarning ? 'Species note present' : '—'}
      </td>
    </tr>
  `).join('');

  const confLevel = confidenceScore >= 85 ? 'High' : confidenceScore >= 60 ? 'Moderate' : 'Low';
  const confColor = confidenceScore >= 85 ? '#059669' : confidenceScore >= 60 ? '#d97706' : '#dc2626';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>NUVOVET DUR Report — ${patientInfo?.name ?? 'Patient'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 12px;
      color: #1e293b;
      background: #fff;
      padding: 32px;
      line-height: 1.5;
    }
    h1 { font-size: 18px; font-weight: 700; color: #0f172a; }
    h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 8px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #0f172a; margin-bottom: 20px; }
    .logo { display: flex; align-items: center; gap: 8px; }
    .logo-hex { width: 28px; height: 28px; }
    .logo-name { font-size: 14px; font-weight: 800; letter-spacing: 0.1em; color: #0f172a; }
    .meta { font-size: 11px; color: #64748b; text-align: right; line-height: 1.6; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
    .kv { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .kv .k { color: #64748b; font-size: 11px; }
    .kv .v { font-weight: 600; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead th {
      text-align: left;
      padding: 8px 10px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
      background: #f8fafc;
      border-bottom: 2px solid #e2e8f0;
    }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
    .badge-ok { background: #dcfce7; color: #166534; }
    .badge-warn { background: #fef9c3; color: #854d0e; }
    .badge-crit { background: #fee2e2; color: #991b1b; }
    .footer { border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; display: flex; justify-content: space-between; align-items: center; }
    .sign-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 16px; min-width: 220px; }
    .sign-label { font-size: 10px; color: #94a3b8; margin-bottom: 20px; }
    .sign-line { border-top: 1px solid #334155; margin-top: 4px; padding-top: 4px; font-size: 10px; color: #94a3b8; }
    .disclaimer { font-size: 10px; color: #94a3b8; max-width: 380px; line-height: 1.5; }
    .conf-bar { height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin-top: 4px; }
    .conf-fill { height: 100%; border-radius: 3px; }
    @media print {
      body { padding: 16px; }
      @page { margin: 1cm; size: A4; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="logo">
        <svg class="logo-hex" viewBox="0 0 28 28" fill="none">
          <path d="M14 2L25.26 8.5V21.5L14 28L2.74 21.5V8.5L14 2Z" fill="#0f172a"/>
          <circle cx="14" cy="14" r="3" fill="white"/>
          <line x1="14" y1="7" x2="14" y2="11" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="14" y1="17" x2="14" y2="21" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="8.5" y1="10.5" x2="11.5" y2="12.3" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="16.5" y1="15.7" x2="19.5" y2="17.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="19.5" y1="10.5" x2="16.5" y2="12.3" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="11.5" y1="15.7" x2="8.5" y2="17.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <div>
          <div class="logo-name">NUVOVET</div>
          <div style="font-size:10px;color:#64748b">Drug Utilization Review System</div>
        </div>
      </div>
    </div>
    <div class="meta">
      <strong style="font-size:13px;color:#0f172a">DUR Analysis Report</strong><br/>
      ${dateStr}<br/>
      Document ID: NV-${Date.now().toString(36).toUpperCase()}
    </div>
  </div>

  <!-- Patient + Summary grid -->
  <div class="grid2">
    <div class="card">
      <h2>Patient</h2>
      ${patientInfo?.name ? `<div class="kv"><span class="k">Name</span><span class="v">${patientInfo.name}</span></div>` : ''}
      ${patientInfo?.species ? `<div class="kv"><span class="k">Species</span><span class="v">${patientInfo.species === 'dog' ? 'Canine' : 'Feline'}</span></div>` : ''}
      ${patientInfo?.breed ? `<div class="kv"><span class="k">Breed</span><span class="v">${patientInfo.breed}</span></div>` : ''}
      ${patientInfo?.weight ? `<div class="kv"><span class="k">Weight</span><span class="v">${patientInfo.weight} kg</span></div>` : ''}
      ${patientInfo?.conditions?.length ? `<div class="kv"><span class="k">Conditions</span><span class="v">${patientInfo.conditions.join(', ')}</span></div>` : ''}
    </div>
    <div class="card">
      <h2>Scan Summary</h2>
      <div class="kv"><span class="k">Drugs Screened</span><span class="v">${drugFlags.length}</span></div>
      <div class="kv"><span class="k">Interactions Found</span><span class="v">${interactions.length}</span></div>
      <div class="kv"><span class="k">Critical</span><span class="v" style="color:#dc2626">${criticalCount}</span></div>
      <div class="kv"><span class="k">Moderate</span><span class="v" style="color:#d97706">${moderateCount}</span></div>
      <div class="kv"><span class="k">Minor</span><span class="v">${minorCount}</span></div>
      <div class="kv" style="margin-top:8px">
        <span class="k">Confidence</span>
        <span class="v" style="color:${confColor}">${confidenceScore}% — ${confLevel}</span>
      </div>
      <div class="conf-bar">
        <div class="conf-fill" style="width:${confidenceScore}%;background:${confColor}"></div>
      </div>
    </div>
  </div>

  <!-- Interactions -->
  ${interactions.length > 0 ? `
  <h2>Interaction Report</h2>
  <table>
    <thead>
      <tr>
        <th>Severity</th>
        <th>Drug Pair</th>
        <th>Rule</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      ${interactionRows}
    </tbody>
  </table>
  ` : `
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:20px">
    <strong style="color:#166534">✓ No drug interactions detected</strong>
    <p style="color:#15803d;font-size:11px;margin-top:4px">All ${drugFlags.length} drug pairs screened — no contraindications found.</p>
  </div>
  `}

  <!-- Drug Advisory -->
  ${drugFlags.some(df => df.flags.length > 0 || df.speciesNote) ? `
  <h2>Drug Advisory Flags</h2>
  <table>
    <thead>
      <tr>
        <th>Drug</th>
        <th>Flags</th>
        <th>Species Note</th>
      </tr>
    </thead>
    <tbody>
      ${drugRows}
    </tbody>
  </table>
  ` : ''}

  <!-- Footer / Acknowledgment -->
  <div class="footer">
    <div class="sign-box">
      <div class="sign-label">Prescribing Veterinarian Acknowledgment</div>
      <div class="sign-line">Signature &amp; Date</div>
      <div style="margin-top:8px" class="sign-label">License No.</div>
      <div class="sign-line" style="margin-top:20px">Name (print)</div>
    </div>
    <div class="disclaimer">
      This report was generated by the NUVOVET Drug Utilization Review
      System and is intended for veterinary professional use only.
      It does not replace clinical judgment.  All prescribing decisions
      remain the sole responsibility of the licensed veterinarian.
      <br/><br/>
      NUVOVET · vetdur.nuvovet.com · Regulatory use: MFDS trial dataset
    </div>
  </div>

</body>
</html>`;
}

export function ScanExportButton({ results, patientInfo, drugs, species }) {
  const { t, lang } = useI18n();

  const handleExport = () => {
    const html = buildPrintHTML({ results, patientInfo, drugs, species });
    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (!printWin) {
      // Fallback if popup is blocked
      window.print();
      return;
    }
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 500);
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center justify-center gap-1.5 px-4 py-2.5 w-full bg-slate-700 text-white text-[13px] font-medium rounded-lg hover:bg-slate-600 transition-colors"
    >
      <Download size={14} />
      {t.results.exportPDF}
    </button>
  );
}
