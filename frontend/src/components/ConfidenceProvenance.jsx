import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * Confidence Provenance
 *
 * Transforms an opaque confidence percentage into an explainable,
 * per-drug breakdown built from drug source, species data completeness,
 * and literature availability.  A vet who understands *why* the
 * confidence is 74 % trusts the system more than one who just sees 74 %.
 */

// ── Per-drug confidence calculation ─────────────────────────────
function getDrugConfidence(drug, species) {
  const reasons = [];
  let score;

  switch (drug.source) {
    case 'kr_vet':
      score = 94;
      reasons.push('koreanDbVerified');
      break;
    case 'human_offlabel':
      score = 68;
      reasons.push('humanOffLabelPkExtrapolated');
      break;
    case 'foreign':
      score = 76;
      reasons.push('foreignFormularyData');
      break;
    default:
      score = 42;
      reasons.push('limitedVeterinaryLiterature');
  }

  // Deduct for missing species-specific data
  if (species === 'cat' && !drug.speciesNotes?.cat) {
    score -= 14;
    reasons.push('catPkDataIncomplete');
  }

  // Deduct for incomplete PK parameters
  if (!drug.pk?.halfLife) {
    score -= 10;
    reasons.push('pkParametersIncomplete');
  }

  // Deduct for NTI drugs (more uncertainty)
  if (drug.narrowTherapeuticIndex) {
    score -= 4;
    reasons.push('narrowTherapeuticIndex');
  }

  // Deduct for unknown active substance
  if (!drug.activeSubstance || drug.activeSubstance === 'Unknown') {
    score -= 22;
    reasons.push('activeIngredientUnconfirmed');
  }

  return { score: Math.max(score, 15), reasons };
}

function BarFill({ pct, color }) {
  const filled = Math.round(pct / 10); // blocks out of 10
  const empty = 10 - filled;
  return (
    <span className={`font-mono text-[12px] tracking-tight ${color}`}>
      {'█'.repeat(filled)}
      <span className="text-slate-200">{'█'.repeat(empty)}</span>
    </span>
  );
}

function getScoreColor(score) {
  if (score >= 85) return { text: 'text-emerald-600', bar: 'bg-emerald-500' };
  if (score >= 60) return { text: 'text-amber-600', bar: 'bg-amber-400' };
  return { text: 'text-red-500', bar: 'bg-red-400' };
}

export function ConfidenceProvenance({ confidenceScore, drugs = [], species = 'dog' }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const overallColor = getScoreColor(confidenceScore);

  const perDrug = drugs.map((drug) => {
    const { score, reasons } = getDrugConfidence(drug, species);
    return { drug, score, reasons };
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header / Summary row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Info size={13} className="text-slate-400" />
          <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">
            {t.results.analysisConfidence}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[14px] font-bold font-mono ${overallColor.text}`}>
            {confidenceScore}%
          </span>
          {expanded ? (
            <ChevronUp size={13} className="text-slate-400" />
          ) : (
            <ChevronDown size={13} className="text-slate-400" />
          )}
        </div>
      </button>

      {/* Overall bar */}
      <div className="px-4 pb-3">
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${overallColor.bar} rounded-full transition-all duration-1000`}
            style={{ width: `${confidenceScore}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className={`text-[10px] ${overallColor.text}`}>
            {confidenceScore >= 85
              ? t.results.confidenceHigh
              : confidenceScore >= 60
              ? t.results.confidenceModerate
              : t.results.confidenceLow}
          </p>
          {!expanded && drugs.length > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors underline"
            >
              {t.results.whyThisScore}
            </button>
          )}
        </div>
      </div>

      {/* Per-drug breakdown */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3 animate-fade-in">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {t.results.perDrugDataQuality}
          </p>

          {perDrug.length === 0 && (
            <p className="text-[12px] text-slate-400 italic">{t.results.noDrugDataAvailable}</p>
          )}

          {perDrug.map(({ drug, score, reasons }, i) => {
            const { text } = getScoreColor(score);
            return (
              <div key={i}>
                <div className="flex items-start gap-3">
                  {/* Drug name */}
                  <span className="text-[12px] font-medium text-slate-700 w-28 truncate shrink-0 mt-0.5">
                    {drug.name}
                  </span>
                  {/* Block bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <BarFill pct={score} color={text} />
                      <span className={`text-[12px] font-mono font-semibold ${text}`}>
                        {score}%
                      </span>
                    </div>
                    {/* Reason tags */}
                    <div className="flex flex-wrap gap-1">
                      {reasons.map((r, j) => (
                        <span
                          key={j}
                          className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100"
                        >
                          {t.results.confidenceReasons[r] || r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {i < perDrug.length - 1 && <div className="border-b border-slate-50 mt-2.5" />}
              </div>
            );
          })}

          <p className="text-[10px] text-slate-400 leading-relaxed pt-1 border-t border-slate-50">
            {t.results.confidenceFootnote}
          </p>
        </div>
      )}
    </div>
  );
}
