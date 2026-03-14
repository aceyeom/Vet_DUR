import React, { useState } from 'react';
import { Activity, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useI18n } from '../i18n';

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

function getOrganLoads(drugs, species) {
  let renalLoad = 0;
  let hepaticLoad = 0;
  const contributions = [];

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

    // Dose scaling modifier
    const prescribedDose = drug.dosePerKg ?? 0;
    const standardDose = drug.defaultDose?.[species] ?? null;
    let doseModifier = 1.0;
    let doseScalingApplied = false;

    if (prescribedDose > 0 && standardDose != null && standardDose > 0) {
      doseModifier = Math.min(Math.max(prescribedDose / standardDose, 0.5), 2.0);
      doseScalingApplied = true;
    }

    const scaledRenal = renal * doseModifier;
    const scaledHepatic = hepatic * doseModifier;

    renalLoad += scaledRenal;
    hepaticLoad += scaledHepatic;

    contributions.push({
      drugId: drug.id,
      drugName: drug.name,
      baseRenal: Math.round(renal * 100),
      baseHepatic: Math.round(hepatic * 100),
      doseModifier: Math.round(doseModifier * 100) / 100,
      scaledRenal: Math.round(scaledRenal * 100),
      scaledHepatic: Math.round(scaledHepatic * 100),
      doseScalingApplied,
    });
  });

  return {
    renal: Math.round(renalLoad * 100),
    hepatic: Math.round(hepaticLoad * 100),
    contributions,
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

export function OrganLoadIndicator({ drugs = [], patientInfo, species = 'dog' }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  if (drugs.length === 0) return null;

  const { renal, hepatic, contributions } = getOrganLoads(drugs, species);

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
            {t.results.cumulativeOrganLoad}
          </span>
          {isCritical && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
              <AlertTriangle size={9} />
              {t.results.compromisedKidney}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[12px] font-mono font-semibold ${renalRisk.text}`}>
            {renal}% {t.results.renalShort}
          </span>
          {expanded ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
        </div>
      </button>

      {/* Critical banner */}
      {isCritical && (
        <div className="mx-4 mb-2 px-3 py-2 bg-red-100 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertTriangle size={13} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-700 leading-relaxed">
            {t.results.organLoadCriticalPrefix} <strong>{renal}%</strong> {t.results.organLoadCriticalBody}
          </p>
        </div>
      )}

      {/* Bars (always visible) */}
      <div className="px-4 pb-3 space-y-2.5">
        <OrganBar
          label={t.results.renalEliminationBurden}
          pct={renal}
          barColor={renalRisk.bar}
          textColor={renalRisk.text}
          labelRight={t.results.riskLevel[renalRisk.level] || renalRisk.label}
        />
        <OrganBar
          label={t.results.hepaticEliminationBurden}
          pct={hepatic}
          barColor={hepaticRisk.bar}
          textColor={hepaticRisk.text}
          labelRight={t.results.riskLevel[hepaticRisk.level] || hepaticRisk.label}
        />
      </div>

      {/* Per-drug breakdown */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-slate-100 pt-3 animate-fade-in">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            {t.results.perDrugContribution}
          </p>
          <div className="space-y-1.5">
            {contributions.map((c, i) => (
              <div key={i} className="flex flex-col gap-0.5 py-1 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="font-medium text-slate-700 w-32 truncate shrink-0">{c.drugName}</span>
                  <span className="text-slate-400 font-mono">
                    {t.results.renalShort} <span className="text-slate-600 font-semibold">{c.scaledRenal}%</span>
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400 font-mono">
                    {t.results.hepaticShort} <span className="text-slate-600 font-semibold">{c.scaledHepatic}%</span>
                  </span>
                  {c.doseScalingApplied && c.doseModifier !== 1.0 && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${c.doseModifier > 1 ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                      ×{c.doseModifier}
                    </span>
                  )}
                </div>
                {c.doseScalingApplied && c.doseModifier !== 1.0 && (
                  <div className="text-[10px] text-slate-400 pl-[9.5rem]">
                    {t.results.doseScalingApplied}: {c.baseRenal}% → {c.scaledRenal}%
                  </div>
                )}
                {!c.doseScalingApplied && (
                  <div className="text-[10px] text-slate-400 pl-[9.5rem]">
                    {t.results.doseScalingNotApplied}
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
            {t.results.organLoadFootnote}
          </p>
        </div>
      )}
    </div>
  );
}
