import React, { useMemo } from 'react';
import { useI18n } from '../i18n';

// ── Comprehensive PK parameters aligned with drugDatabase.js ─────
// Values sourced from drug.pk fields: halfLife, timeToPeak, bioavailability
// Therapeutic index approximations for visualization
const PK_PARAMS = {
  meloxicam:      { tmax: 7.5, halfLife: 24,  interval: 24, bioavail: 0.89, therapMin: 0.25, therapMax: 0.85, unit: 'mg/kg' },
  prednisolone:   { tmax: 1.5, halfLife: 3,   interval: 24, bioavail: 0.76, therapMin: 0.15, therapMax: 0.90, unit: 'mg/kg' },
  carprofen:      { tmax: 3,   halfLife: 8,   interval: 12, bioavail: 0.90, therapMin: 0.20, therapMax: 0.85, unit: 'mg/kg' },
  phenobarbital:  { tmax: 4,   halfLife: 52,  interval: 12, bioavail: 0.86, therapMin: 0.40, therapMax: 0.80, unit: 'µg/mL' },
  furosemide:     { tmax: 1,   halfLife: 1.5, interval: 12, bioavail: 0.77, therapMin: 0.15, therapMax: 0.90, unit: 'mg/L' },
  gabapentin:     { tmax: 2,   halfLife: 3.5, interval: 8,  bioavail: 0.80, therapMin: 0.20, therapMax: 0.85, unit: 'µg/mL' },
  ketoconazole:   { tmax: 2,   halfLife: 6,   interval: 12, bioavail: 0.75, therapMin: 0.20, therapMax: 0.80, unit: 'µg/mL' },
  metronidazole:  { tmax: 1,   halfLife: 4.5, interval: 12, bioavail: 0.80, therapMin: 0.25, therapMax: 0.85, unit: 'µg/mL' },
  cyclosporine:   { tmax: 2,   halfLife: 18,  interval: 12, bioavail: 0.29, therapMin: 0.35, therapMax: 0.75, unit: 'ng/mL' },
  tramadol:       { tmax: 1.5, halfLife: 1.8, interval: 8,  bioavail: 0.65, therapMin: 0.20, therapMax: 0.85, unit: 'ng/mL' },
  amoxicillin:    { tmax: 1,   halfLife: 1.2, interval: 8,  bioavail: 0.80, therapMin: 0.25, therapMax: 0.90, unit: 'µg/mL' },
  enrofloxacin:   { tmax: 2,   halfLife: 4,   interval: 24, bioavail: 0.80, therapMin: 0.20, therapMax: 0.85, unit: 'µg/mL' },
  ivermectin:     { tmax: 4,   halfLife: 25,  interval: 24, bioavail: 0.95, therapMin: 0.30, therapMax: 0.70, unit: 'ng/mL' },
  digoxin:        { tmax: 2,   halfLife: 27,  interval: 12, bioavail: 0.60, therapMin: 0.45, therapMax: 0.70, unit: 'ng/mL' },
  enalapril:      { tmax: 4,   halfLife: 11,  interval: 12, bioavail: 0.60, therapMin: 0.20, therapMax: 0.85, unit: 'ng/mL' },
  maropitant:     { tmax: 2,   halfLife: 7.5, interval: 24, bioavail: 0.91, therapMin: 0.20, therapMax: 0.85, unit: 'ng/mL' },
  omeprazole:     { tmax: 0.5, halfLife: 1,   interval: 12, bioavail: 0.50, therapMin: 0.20, therapMax: 0.90, unit: 'µg/mL' },
  trazodone:      { tmax: 1.5, halfLife: 7,   interval: 12, bioavail: 0.85, therapMin: 0.20, therapMax: 0.80, unit: 'ng/mL' },
  amlodipine:     { tmax: 6,   halfLife: 30,  interval: 24, bioavail: 0.88, therapMin: 0.30, therapMax: 0.80, unit: 'ng/mL' },
  fluoxetine:     { tmax: 6,   halfLife: 48,  interval: 24, bioavail: 0.72, therapMin: 0.30, therapMax: 0.75, unit: 'ng/mL' },
  methimazole:    { tmax: 1,   halfLife: 5,   interval: 12, bioavail: 0.80, therapMin: 0.25, therapMax: 0.80, unit: 'µg/mL' },
  dexamethasone:  { tmax: 1,   halfLife: 2,   interval: 24, bioavail: 0.80, therapMin: 0.15, therapMax: 0.90, unit: 'ng/mL' },
  selamectin:     { tmax: 72,  halfLife: 264, interval: 720, bioavail: 0.50, therapMin: 0.20, therapMax: 0.80, unit: 'ng/mL' },
  pimobendan:     { tmax: 3,   halfLife: 0.5, interval: 12, bioavail: 0.60, therapMin: 0.20, therapMax: 0.85, unit: 'ng/mL' },
  oclacitinib:    { tmax: 1,   halfLife: 4,   interval: 12, bioavail: 0.89, therapMin: 0.20, therapMax: 0.85, unit: 'ng/mL' },
  firocoxib:      { tmax: 1.5, halfLife: 7.8, interval: 24, bioavail: 0.94, therapMin: 0.20, therapMax: 0.85, unit: 'ng/mL' },
};

// ── Resolve PK params from drug object ───────────────────────────
function getPkParams(drug) {
  if (!drug) return null;
  const id = drug.id || drug.name?.toLowerCase();
  if (PK_PARAMS[id]) return { ...PK_PARAMS[id], name: drug.name, nameKr: drug.nameKr };

  // Fallback to drug.pk field from drugDatabase
  const pk = drug.pk;
  if (pk?.timeToPeak && pk?.halfLife) {
    return {
      tmax: pk.timeToPeak,
      halfLife: pk.halfLife,
      interval: drug.freq === 'TID' ? 8 : drug.freq === 'BID' ? 12 : drug.freq === 'Monthly' ? 720 : 24,
      bioavail: pk.bioavailability || 0.8,
      therapMin: 0.20,
      therapMax: 0.85,
      unit: 'relative',
      name: drug.name,
      nameKr: drug.nameKr,
    };
  }
  return null;
}

// ── One-compartment PK model: absorption + elimination ───────────
// Uses first-order absorption with Bateman equation approximation
function generateConcentrationCurve(pk, startHour, maxHour = 24) {
  const { tmax, halfLife, bioavail } = pk;
  const ke = Math.LN2 / halfLife;                    // elimination rate constant
  const ka = (tmax > 0) ? (2.5 / tmax) : 5;         // absorption rate constant (approximation)
  const points = [];
  const resolution = 200;                              // points for smoothness

  for (let i = 0; i <= resolution; i++) {
    const t = (i / resolution) * (maxHour - startHour);
    const absT = startHour + t;
    if (absT > maxHour) break;

    // Bateman equation: C(t) = F * (ka / (ka - ke)) * (e^(-ke*t) - e^(-ka*t))
    let conc;
    if (Math.abs(ka - ke) < 0.001) {
      conc = bioavail * ka * t * Math.exp(-ke * t);
    } else {
      conc = bioavail * (ka / (ka - ke)) * (Math.exp(-ke * t) - Math.exp(-ka * t));
    }

    // Normalize: find theoretical Cmax for scaling
    const tMaxTheory = Math.log(ka / ke) / (ka - ke);
    let cmax;
    if (Math.abs(ka - ke) < 0.001) {
      cmax = bioavail * ka * tMaxTheory * Math.exp(-ke * tMaxTheory);
    } else {
      cmax = bioavail * (ka / (ka - ke)) * (Math.exp(-ke * tMaxTheory) - Math.exp(-ka * tMaxTheory));
    }

    const normalized = cmax > 0 ? conc / cmax : 0;
    points.push({ x: absT, y: Math.max(0, Math.min(1, normalized)) });
  }
  return points;
}

// ── Multi-dose superposition over 24h ────────────────────────────
function buildMultiDoseCurve(pk) {
  const { interval } = pk;
  const maxHour = 24;

  // Generate individual dose curves
  const doseCurves = [];
  for (let start = 0; start < maxHour; start += Math.min(interval, maxHour)) {
    doseCurves.push(generateConcentrationCurve(pk, start, maxHour));
  }

  // Superposition: sum concentrations at each time point
  const resolution = 200;
  const merged = [];
  for (let i = 0; i <= resolution; i++) {
    const hour = (i / resolution) * maxHour;
    let totalConc = 0;
    for (const curve of doseCurves) {
      // Find nearest point
      let best = 0;
      let bestDist = Infinity;
      for (let j = 0; j < curve.length; j++) {
        const dist = Math.abs(curve[j].x - hour);
        if (dist < bestDist) { bestDist = dist; best = j; }
      }
      if (bestDist < 0.2) totalConc += curve[best].y;
    }
    merged.push({ x: hour, y: Math.min(1.3, totalConc) }); // allow slight overshoot for accumulation
  }
  return merged;
}

// ── SVG path helpers ─────────────────────────────────────────────
function curveToPath(points, w, h, pl, pr, pt, pb) {
  const uw = w - pl - pr;
  const uh = h - pt - pb;
  const maxY = Math.max(...points.map(p => p.y), 1);
  return points.map((p, i) => {
    const x = pl + (p.x / 24) * uw;
    const y = pt + uh - (p.y / maxY) * uh;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function curveToArea(points, w, h, pl, pr, pt, pb) {
  const uw = w - pl - pr;
  const uh = h - pt - pb;
  const maxY = Math.max(...points.map(p => p.y), 1);
  const baseline = pt + uh;

  const line = points.map((p, i) => {
    const x = pl + (p.x / 24) * uw;
    const y = pt + uh - (p.y / maxY) * uh;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const lastX = pl + (points[points.length - 1].x / 24) * uw;
  const firstX = pl + (points[0].x / 24) * uw;
  return `${line} L${lastX.toFixed(1)},${baseline} L${firstX.toFixed(1)},${baseline} Z`;
}

// ── Find peak point ──────────────────────────────────────────────
function findPeak(points) {
  return points.reduce((max, p) => p.y > max.y ? p : max, points[0]);
}

// ── Find trough (minimum after first dose peak) ─────────────────
function findTrough(points, interval) {
  if (interval >= 24) return null;
  // Look for local minimum near next dose time
  const target = interval;
  const candidates = points.filter(p => Math.abs(p.x - target) < 1.5);
  if (candidates.length === 0) return null;
  return candidates.reduce((min, p) => p.y < min.y ? p : min, candidates[0]);
}

// ── Colors for drug curves ───────────────────────────────────────
const COLORS = {
  A: { line: '#1e293b', fill: '#1e293b', accent: '#3b82f6' },  // slate-800 / blue
  B: { line: '#6366f1', fill: '#6366f1', accent: '#8b5cf6' },  // indigo / violet
};

export function DrugTimeline({ drugA, drugB }) {
  const { t, lang } = useI18n();

  const pkA = useMemo(() => getPkParams(drugA), [drugA]);
  const pkB = useMemo(() => getPkParams(drugB), [drugB]);

  const hasA = !!pkA;
  const hasB = !!pkB;

  if (!hasA && !hasB) return null;

  const curveA = useMemo(() => hasA ? buildMultiDoseCurve(pkA) : [], [pkA, hasA]);
  const curveB = useMemo(() => hasB ? buildMultiDoseCurve(pkB) : [], [pkB, hasB]);

  // SVG dimensions
  const svgW = 500;
  const svgH = 160;
  const padL = 40;   // space for Y-axis label
  const padR = 10;
  const padT = 12;
  const padB = 28;   // space for X-axis labels
  const usableW = svgW - padL - padR;
  const usableH = svgH - padT - padB;
  const maxY = Math.max(
    ...(hasA ? curveA.map(p => p.y) : [1]),
    ...(hasB ? curveB.map(p => p.y) : [1]),
    1
  );

  // Helper to convert data coords to SVG coords
  const toSvg = (x, y) => ({
    sx: padL + (x / 24) * usableW,
    sy: padT + usableH - (y / maxY) * usableH,
  });

  const peakA = hasA ? findPeak(curveA) : null;
  const peakB = hasB ? findPeak(curveB) : null;
  const troughA = hasA ? findTrough(curveA, pkA.interval) : null;

  // Therapeutic window bands
  const therapMinA = hasA ? pkA.therapMin : 0.2;
  const therapMaxA = hasA ? pkA.therapMax : 0.85;

  const ticks = [0, 4, 8, 12, 16, 20, 24];
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  // Dosing arrows
  const doseTimesA = hasA ? Array.from({ length: Math.ceil(24 / pkA.interval) }, (_, i) => i * pkA.interval).filter(t => t < 24) : [];
  const doseTimesB = hasB ? Array.from({ length: Math.ceil(24 / pkB.interval) }, (_, i) => i * pkB.interval).filter(t => t < 24) : [];

  // Frequency label
  const freqLabel = (interval) => {
    if (interval <= 8) return t.pk.freqTID;
    if (interval <= 12) return t.pk.freqBID;
    return t.pk.freqSID;
  };

  return (
    <div className="mt-2 mb-1">
      <div className="flex items-center justify-between mb-2">
        <span className="typo-section-header">{t.pk.title}</span>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* Gradient fills for drug curves */}
            <linearGradient id="gradA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.A.fill} stopOpacity="0.12" />
              <stop offset="100%" stopColor={COLORS.A.fill} stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="gradB" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.B.fill} stopOpacity="0.10" />
              <stop offset="100%" stopColor={COLORS.B.fill} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* ── Therapeutic window band ── */}
          {hasA && (
            <rect
              x={padL} y={toSvg(0, therapMaxA).sy}
              width={usableW}
              height={toSvg(0, therapMinA).sy - toSvg(0, therapMaxA).sy}
              fill="#10b981" fillOpacity="0.06"
              stroke="#10b981" strokeOpacity="0.15" strokeWidth="0.5" strokeDasharray="3,3"
            />
          )}

          {/* ── Y-axis gridlines + labels ── */}
          {yTicks.map(yVal => {
            const { sy } = toSvg(0, yVal);
            return (
              <g key={yVal}>
                <line x1={padL} y1={sy} x2={svgW - padR} y2={sy}
                  stroke="#e2e8f0" strokeWidth="0.3" />
                <text x={padL - 4} y={sy + 3} textAnchor="end"
                  style={{ fontSize: '7px', fontFamily: '"DM Mono", monospace', fill: '#94a3b8' }}>
                  {(yVal * 100).toFixed(0)}%
                </text>
              </g>
            );
          })}

          {/* ── Y-axis title ── */}
          <text
            x={8} y={padT + usableH / 2}
            textAnchor="middle"
            transform={`rotate(-90, 8, ${padT + usableH / 2})`}
            style={{ fontSize: '7px', fontFamily: '"DM Sans"', fill: '#94a3b8', letterSpacing: '0.02em' }}
          >
            {t.pk.concentrationRelative}
          </text>

          {/* ── X-axis gridlines + labels ── */}
          {ticks.map(tick => {
            const { sx } = toSvg(tick, 0);
            return (
              <g key={tick}>
                <line x1={sx} y1={padT} x2={sx} y2={padT + usableH}
                  stroke="#e2e8f0" strokeWidth="0.3" strokeDasharray={tick % 12 === 0 ? 'none' : '2,2'} />
                <text x={sx} y={svgH - 6} textAnchor="middle"
                  style={{ fontSize: '8px', fontFamily: '"DM Mono", monospace', fill: '#64748b' }}>
                  {tick}h
                </text>
              </g>
            );
          })}

          {/* ── Baseline ── */}
          <line x1={padL} y1={padT + usableH} x2={svgW - padR} y2={padT + usableH}
            stroke="#cbd5e1" strokeWidth="0.5" />
          <line x1={padL} y1={padT} x2={padL} y2={padT + usableH}
            stroke="#cbd5e1" strokeWidth="0.5" />

          {/* ── Dose administration arrows ── */}
          {doseTimesA.map((dt, i) => {
            const { sx } = toSvg(dt, 0);
            return (
              <g key={`doseA-${i}`}>
                <line x1={sx} y1={padT + usableH} x2={sx} y2={padT + usableH + 5}
                  stroke={COLORS.A.line} strokeWidth="1" />
                <polygon
                  points={`${sx},${padT + usableH - 2} ${sx - 2},${padT + usableH + 3} ${sx + 2},${padT + usableH + 3}`}
                  fill={COLORS.A.line} fillOpacity="0.5"
                />
              </g>
            );
          })}
          {doseTimesB.map((dt, i) => {
            const { sx } = toSvg(dt, 0);
            return (
              <g key={`doseB-${i}`}>
                <polygon
                  points={`${sx + 3},${padT + usableH - 2} ${sx + 1},${padT + usableH + 3} ${sx + 5},${padT + usableH + 3}`}
                  fill={COLORS.B.line} fillOpacity="0.4"
                />
              </g>
            );
          })}

          {/* ── Drug A: area + line ── */}
          {hasA && curveA.length > 0 && (
            <>
              <path d={curveToArea(curveA, svgW, svgH, padL, padR, padT, padB)} fill="url(#gradA)" />
              <path d={curveToPath(curveA, svgW, svgH, padL, padR, padT, padB)}
                fill="none" stroke={COLORS.A.line} strokeWidth="1.5" strokeLinecap="round" />
            </>
          )}

          {/* ── Drug B: area + line ── */}
          {hasB && curveB.length > 0 && (
            <>
              <path d={curveToArea(curveB, svgW, svgH, padL, padR, padT, padB)} fill="url(#gradB)" />
              <path d={curveToPath(curveB, svgW, svgH, padL, padR, padT, padB)}
                fill="none" stroke={COLORS.B.line} strokeWidth="1.5" strokeDasharray="5,3" strokeLinecap="round" />
            </>
          )}

          {/* ── Cmax marker for Drug A ── */}
          {hasA && peakA && (() => {
            const { sx, sy } = toSvg(peakA.x, peakA.y);
            return (
              <g>
                <circle cx={sx} cy={sy} r="3" fill="white" stroke={COLORS.A.line} strokeWidth="1.5" />
                <text x={sx + 5} y={sy - 5}
                  style={{ fontSize: '7px', fontFamily: '"DM Mono", monospace', fill: COLORS.A.line, fontWeight: 600 }}>
                  Cmax
                </text>
                {/* Tmax annotation */}
                <line x1={sx} y1={sy + 3} x2={sx} y2={padT + usableH}
                  stroke={COLORS.A.line} strokeWidth="0.5" strokeDasharray="1,2" strokeOpacity="0.3" />
                <text x={sx} y={padT + usableH + 16} textAnchor="middle"
                  style={{ fontSize: '6px', fontFamily: '"DM Mono", monospace', fill: '#94a3b8' }}>
                  Tmax {pkA.tmax}h
                </text>
              </g>
            );
          })()}

          {/* ── Cmax marker for Drug B ── */}
          {hasB && peakB && (() => {
            const { sx, sy } = toSvg(peakB.x, peakB.y);
            return (
              <g>
                <circle cx={sx} cy={sy} r="3" fill="white" stroke={COLORS.B.line} strokeWidth="1.5" />
                <text x={sx + 5} y={sy - 5}
                  style={{ fontSize: '7px', fontFamily: '"DM Mono", monospace', fill: COLORS.B.line, fontWeight: 600 }}>
                  Cmax
                </text>
              </g>
            );
          })()}

          {/* ── Trough marker for Drug A ── */}
          {hasA && troughA && (() => {
            const { sx, sy } = toSvg(troughA.x, troughA.y);
            return (
              <g>
                <circle cx={sx} cy={sy} r="2.5" fill="white" stroke={COLORS.A.line} strokeWidth="1" />
                <text x={sx + 4} y={sy + 3}
                  style={{ fontSize: '6px', fontFamily: '"DM Mono", monospace', fill: '#94a3b8' }}>
                  Cmin
                </text>
              </g>
            );
          })()}

          {/* ── Therapeutic window label ── */}
          {hasA && (
            <text x={svgW - padR - 2} y={toSvg(0, (therapMinA + therapMaxA) / 2).sy + 3}
              textAnchor="end"
              style={{ fontSize: '6px', fontFamily: '"DM Sans"', fill: '#10b981', fontWeight: 500 }}>
              {t.pk.therapeuticBand}
            </text>
          )}

          {/* ── X-axis title ── */}
          <text x={padL + usableW / 2} y={svgH - 0}
            textAnchor="middle"
            style={{ fontSize: '7px', fontFamily: '"DM Sans"', fill: '#94a3b8' }}>
            {t.pk.timeAxis}
          </text>
        </svg>

        {/* ── Legend + PK Summary ── */}
        <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            {hasA && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke={COLORS.A.line} strokeWidth="2" /></svg>
                  <span className="text-[11px] font-semibold text-slate-800">
                    {lang === 'ko' && drugA.nameKr ? drugA.nameKr : drugA.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                  <span>t½ {pkA.halfLife}h</span>
                  <span>Tmax {pkA.tmax}h</span>
                  <span>{freqLabel(pkA.interval)}</span>
                </div>
              </div>
            )}
            {hasB && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <svg width="16" height="8"><line x1="0" y1="4" x2="16" y2="4" stroke={COLORS.B.line} strokeWidth="2" strokeDasharray="4,2" /></svg>
                  <span className="text-[11px] font-semibold text-slate-800">
                    {lang === 'ko' && drugB.nameKr ? drugB.nameKr : drugB.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                  <span>t½ {pkB.halfLife}h</span>
                  <span>Tmax {pkB.tmax}h</span>
                  <span>{freqLabel(pkB.interval)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Therapeutic window legend */}
          {hasA && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500/10 border border-emerald-500/20" />
              <span className="text-[10px] text-slate-500">
                {t.pk.therapeuticWindow}
                <span className="font-mono ml-1">({(therapMinA * 100).toFixed(0)}–{(therapMaxA * 100).toFixed(0)}% Cmax)</span>
              </span>
            </div>
          )}
        </div>

        {/* ── PK Parameter Table ── */}
        <div className="px-3 py-2 border-t border-slate-100">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-left text-slate-400 uppercase tracking-wider">
                <th className="py-1 font-semibold">{t.pk.drugColumn}</th>
                <th className="py-1 font-semibold text-center">t½</th>
                <th className="py-1 font-semibold text-center">Tmax</th>
                <th className="py-1 font-semibold text-center">{t.pk.bioavailColumn}</th>
                <th className="py-1 font-semibold text-center">{t.pk.dosingColumn}</th>
              </tr>
            </thead>
            <tbody className="font-mono text-slate-700">
              {hasA && (
                <tr className="border-t border-slate-100">
                  <td className="py-1 font-sans font-medium">{lang === 'ko' && drugA.nameKr ? drugA.nameKr : drugA.name}</td>
                  <td className="py-1 text-center">{pkA.halfLife}h</td>
                  <td className="py-1 text-center">{pkA.tmax}h</td>
                  <td className="py-1 text-center">{(pkA.bioavail * 100).toFixed(0)}%</td>
                  <td className="py-1 text-center">{freqLabel(pkA.interval)}</td>
                </tr>
              )}
              {hasB && (
                <tr className="border-t border-slate-100">
                  <td className="py-1 font-sans font-medium">{lang === 'ko' && drugB.nameKr ? drugB.nameKr : drugB.name}</td>
                  <td className="py-1 text-center">{pkB.halfLife}h</td>
                  <td className="py-1 text-center">{pkB.tmax}h</td>
                  <td className="py-1 text-center">{(pkB.bioavail * 100).toFixed(0)}%</td>
                  <td className="py-1 text-center">{freqLabel(pkB.interval)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Partial data notice */}
        {(hasA !== hasB) && (
          <div className="px-3 py-1.5 border-t border-slate-100 bg-amber-50/50">
            <p className="text-[10px] text-amber-600 italic">
              {t.pk.pkDataUnavailable.replace('{name}', !hasA ? drugA?.name : drugB?.name)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
