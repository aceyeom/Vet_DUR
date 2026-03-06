import React, { useState } from 'react';
import { Activity, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

/**
 * Cumulative Organ Load Score
 *
 * Sums renal and hepatic elimination burden across all drugs in the
 * prescription and displays a single organ-load indicator.  When the
 * patient has elevated creatinine (flaggedLabs), the component escalates
 * to a critical flag — not just "this drug is renally cleared" but
 * "this entire prescription places 78 % cumulative load on an already
 * compromised kidney."
 */

function getOrganLoads(drugs) {
  let renalLoad = 0;
  let hepaticLoad = 0;

  drugs.forEach((drug) => {
    const renal = drug.renalElimination ?? 0;
    const hepatic =
      drug.hepaticElimination != null
        ? drug.hepaticElimination
        : drug.pk?.primaryElimination === 'hepatic'
        ? Math.max(1 - renal, 0)
        : drug.pk?.primaryElimination === 'mixed'
        ? Math.max((1 - renal) * 0.5, 0)
        : 0;

    renalLoad += renal;
    hepaticLoad += hepatic;
  });

  return {
    renal: Math.round(renalLoad * 100),
    hepatic: Math.round(hepaticLoad * 100),
  };
}

function getRenalRisk(renalPct, elevatedCreatinine) {
  if (elevatedCreatinine && renalPct >= 40)
    return { level: 'critical', label: 'Critical', bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 border-red-200' };
  if (renalPct >= 120)
    return { level: 'high', label: 'High', bar: 'bg-red-400', text: 'text-red-600', bg: 'bg-red-50 border-red-200' };
  if (renalPct >= 70)
    return { level: 'moderate', label: 'Moderate', bar: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
  return { level: 'low', label: 'Low', bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-white border-slate-200' };
}

function getHepaticRisk(hepaticPct) {
  if (hepaticPct >= 180)
    return { level: 'high', label: 'High', bar: 'bg-amber-500', text: 'text-amber-700' };
  if (hepaticPct >= 100)
    return { level: 'moderate', label: 'Moderate', bar: 'bg-yellow-400', text: 'text-amber-600' };
  return { level: 'low', label: 'Low', bar: 'bg-emerald-500', text: 'text-emerald-700' };
}

function OrganBar({ label, pct, barColor, textColor, labelRight }) {
  // Bar fills proportionally — cap visual at 200 % for layout
  const visualWidth = Math.min((pct / 200) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-slate-600">{label}</span>
        <span className={`text-[11px] font-semibold font-mono ${textColor}`}>
          {pct}%{labelRight && <span className="font-normal text-slate-400 ml-1">({labelRight})</span>}
        </span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${visualWidth}%` }}
        />
      </div>
    </div>
  );
}

export function OrganLoadIndicator({ drugs = [], patientInfo }) {
  const [expanded, setExpanded] = useState(false);

  if (drugs.length === 0) return null;

  const { renal, hepatic } = getOrganLoads(drugs);

  const elevatedCreatinine = patientInfo?.flaggedLabs?.some(
    (lab) =>
      (lab.key?.toLowerCase().includes('creatinine') || lab.key?.toLowerCase().includes('bun')) &&
      lab.status === 'high'
  );

  const renalRisk = getRenalRisk(renal, elevatedCreatinine);
  const hepaticRisk = getHepaticRisk(hepatic);
  const isCritical = renalRisk.level === 'critical';

  return (
    <div className={`rounded-xl border overflow-hidden shadow-sm ${renalRisk.bg}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Activity size={14} className={renalRisk.text} />
          <span className="text-[12px] font-semibold text-slate-700 uppercase tracking-wider">
            Cumulative Organ Load
          </span>
          {isCritical && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
              <AlertTriangle size={9} />
              Compromised Kidney
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[12px] font-mono font-semibold ${renalRisk.text}`}>
            {renal}% renal
          </span>
          {expanded ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
        </div>
      </button>

      {/* Critical banner */}
      {isCritical && (
        <div className="mx-4 mb-2 px-3 py-2 bg-red-100 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertTriangle size={13} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-700 leading-relaxed">
            This prescription places <strong>{renal}%</strong> cumulative load on the renal pathway.
            With elevated creatinine already flagged, this combination requires dose reduction or drug substitution before dispensing.
          </p>
        </div>
      )}

      {/* Bars (always visible) */}
      <div className="px-4 pb-3 space-y-2.5">
        <OrganBar
          label="Renal elimination burden"
          pct={renal}
          barColor={renalRisk.bar}
          textColor={renalRisk.text}
          labelRight={renalRisk.label}
        />
        <OrganBar
          label="Hepatic elimination burden"
          pct={hepatic}
          barColor={hepaticRisk.bar}
          textColor={hepaticRisk.text}
          labelRight={hepaticRisk.label}
        />
      </div>

      {/* Per-drug breakdown */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-slate-100 pt-3 animate-fade-in">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Per-drug contribution
          </p>
          <div className="space-y-1.5">
            {drugs.map((drug, i) => {
              const r = Math.round((drug.renalElimination ?? 0) * 100);
              const h =
                drug.hepaticElimination != null
                  ? Math.round(drug.hepaticElimination * 100)
                  : drug.pk?.primaryElimination === 'hepatic'
                  ? Math.round(Math.max(1 - (drug.renalElimination ?? 0), 0) * 100)
                  : drug.pk?.primaryElimination === 'mixed'
                  ? Math.round(Math.max((1 - (drug.renalElimination ?? 0)) * 0.5, 0) * 100)
                  : 0;
              return (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="font-medium text-slate-700 w-32 truncate shrink-0">{drug.name}</span>
                  <span className="text-slate-400 font-mono">
                    Renal <span className="text-slate-600 font-semibold">{r}%</span>
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400 font-mono">
                    Hepatic <span className="text-slate-600 font-semibold">{h}%</span>
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
            Values represent each drug's primary elimination fraction. Cumulative stacking
            indicates total organ demand — not organ capacity.
          </p>
        </div>
      )}
    </div>
  );
}
