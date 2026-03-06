import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, AlertCircle, Info, CheckCircle, ChevronDown, ChevronUp,
  BookOpen, FlaskConical, Globe, HelpCircle, Dna, ArrowLeft,
  Check, Lightbulb, FileText, Clock, Pill, Flag, Printer, Download,
  Mail, Send
} from 'lucide-react';
import { SeverityBadge } from './SeverityBadge';
import { DRUG_SOURCE } from '../data/drugDatabase';
import { DrugTimeline } from './DrugTimeline';
import { NuvovetLogo } from './NuvovetLogo';
import { OrganLoadIndicator } from './OrganLoadIndicator';
import { ConfidenceProvenance } from './ConfidenceProvenance';
import { ScanExportButton } from './ScanExportPDF';
import { useI18n } from '../i18n';

// ── Overall Severity Banner ─────────────────────────────────────
function SeverityBanner({ results, drugs = [] }) {
  const { t, lang } = useI18n();
  const { interactions, drugFlags, confidenceScore, overallSeverity } = results;
  const criticalCount = interactions.filter(i => i.severity.label === 'Critical').length;
  const moderateCount = interactions.filter(i => i.severity.label === 'Moderate').length;
  const minorCount = interactions.filter(i => i.severity.label === 'Minor' || i.severity.label === 'Unknown').length;

  const isCritical = overallSeverity?.label === 'Critical';
  const isModerate = overallSeverity?.label === 'Moderate';
  const isClear = interactions.length === 0;

  const bannerBg = isCritical
    ? 'bg-red-50 border-red-300'
    : isModerate
    ? 'bg-amber-50 border-amber-300'
    : isClear
    ? 'bg-emerald-50 border-emerald-300'
    : 'bg-yellow-50 border-yellow-200';

  const iconColor = isCritical
    ? 'text-red-500'
    : isModerate
    ? 'text-amber-500'
    : isClear
    ? 'text-emerald-500'
    : 'text-yellow-500';

  const SeverityIcon = isCritical ? AlertTriangle : isModerate ? AlertCircle : isClear ? CheckCircle : Info;

  const confColor = confidenceScore >= 85 ? 'text-emerald-600' : confidenceScore >= 60 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className={`rounded-xl border-2 p-4 mb-5 animate-fade-in ${bannerBg}`}>
      <div className="flex items-start gap-4">
        <div className={`shrink-0 mt-0.5 ${iconColor}`}>
          <SeverityIcon size={28} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <SeverityBadge severity={overallSeverity} size="lg" />
            <span className="text-[13px] font-semibold text-slate-800">
              {t.results.overallSeverity}
            </span>
          </div>
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
            <span className="text-[13px] text-slate-600">
              <span className="font-semibold text-slate-900">{drugFlags.length}</span>{' '}
              {lang === 'ko' ? '종 약물 검사' : 'drugs screened'}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-[13px] text-slate-600">
              <span className="font-semibold text-slate-900">{interactions.length}</span>{' '}
              {lang === 'ko' ? '건 상호작용' : 'interactions'}
            </span>
            {criticalCount > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-[12px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                  {criticalCount} {t.results.critical}
                </span>
              </>
            )}
            {moderateCount > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-[12px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  {moderateCount} {t.results.moderate}
                </span>
              </>
            )}
            {minorCount > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-[12px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                  {minorCount} {t.results.minor}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-2xl font-bold ${confColor}`}>{confidenceScore}%</div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wide">{t.results.confidence}</div>
          <div className="mt-1 w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${confidenceScore >= 85 ? 'bg-emerald-500' : confidenceScore >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${confidenceScore}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Patient Summary Panel (left panel) ────────────────────────
function PatientSummaryPanel({ results, patientInfo, drugs = [], species = 'dog' }) {
  const { t, lang } = useI18n();
  const { interactions, drugFlags, confidenceScore } = results;
  const criticalCount = interactions.filter(i => i.severity.label === 'Critical').length;
  const moderateCount = interactions.filter(i => i.severity.label === 'Moderate').length;
  const minorCount = interactions.filter(i => i.severity.label === 'Minor' || i.severity.label === 'Unknown').length;

  const engines = [
    { id: 'E1', name: 'DDI Pairwise', weight: 35, score: criticalCount > 0 ? 95 : moderateCount > 0 ? 60 : 20 },
    { id: 'E2', name: 'CYP Profile', weight: 25, score: interactions.some(i => i.rule?.includes('CYP')) ? 75 : 15 },
    { id: 'E3', name: 'Species Safety', weight: 20, score: drugFlags.some(f => f.hasSpeciesWarning) ? 80 : 10 },
    { id: 'E4', name: 'Dose Range', weight: 10, score: 25 },
    { id: 'E5', name: 'Allergy Cross', weight: 10, score: 5 },
  ];

  return (
    <div className="space-y-3">
      {patientInfo?.name && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="typo-section-header mb-3">{t.results.patient}</h3>
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline gap-2">
              <span className="typo-label shrink-0">{t.results.patient}</span>
              <span className="typo-drug-name text-[13px] text-right truncate">{patientInfo.name}</span>
            </div>
            {patientInfo.species && (
              <div className="flex justify-between items-baseline gap-2">
                <span className="typo-label shrink-0">{lang === 'ko' ? '종' : 'Species'}</span>
                <span className="text-[13px] font-medium text-slate-700 text-right">{patientInfo.species === 'dog' ? t.species.dog : t.species.cat}</span>
              </div>
            )}
            {patientInfo.breed && (
              <div className="flex justify-between items-baseline gap-2">
                <span className="typo-label shrink-0">{t.results.breed}</span>
                <span className="text-[13px] font-medium text-slate-700 text-right truncate">{patientInfo.breed}</span>
              </div>
            )}
            {patientInfo.weight && (
              <div className="flex justify-between items-baseline gap-2">
                <span className="typo-label shrink-0">{t.results.weight}</span>
                <span className="text-[13px] font-medium text-slate-700">{patientInfo.weight} kg</span>
              </div>
            )}
          </div>
          {patientInfo.conditions && patientInfo.conditions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <span className="typo-label block mb-1.5">{t.results.conditions}</span>
              <div className="flex flex-wrap gap-1">
                {patientInfo.conditions.map((c, i) => (
                  <span key={i} className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">{c}</span>
                ))}
              </div>
            </div>
          )}
          {patientInfo.flaggedLabs && patientInfo.flaggedLabs.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <span className="typo-label block mb-1.5">{t.results.flaggedLabs}</span>
              <div className="flex flex-wrap gap-1">
                {patientInfo.flaggedLabs.map((lab, i) => (
                  <span key={i} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${lab.status === 'high' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                    {lab.key}: {lab.value} {lab.unit} {lab.status === 'high' ? '↑' : '↓'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h3 className="typo-section-header mb-3">{t.results.scanSummary}</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="typo-label">{t.results.drugsScreened}</span>
            <span className="typo-score font-semibold text-slate-900">{drugFlags.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="typo-label">{t.results.interactions}</span>
            <span className="typo-score font-semibold text-slate-900">{interactions.length}</span>
          </div>
          <div className="border-t border-slate-100 pt-2">
            <span className="typo-label block mb-1.5">{t.results.severity}</span>
            <div className="flex flex-wrap gap-1">
              {criticalCount > 0 && <span className="text-[11px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">{criticalCount} {t.results.critical}</span>}
              {moderateCount > 0 && <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{moderateCount} {t.results.moderate}</span>}
              {minorCount > 0 && <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{minorCount} {t.results.minor}</span>}
              {interactions.length === 0 && <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{t.results.noInteractions}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Confidence Provenance */}
      <ConfidenceProvenance
        confidenceScore={confidenceScore}
        drugs={drugs}
        species={species}
      />

      {/* Cumulative Organ Load */}
      <OrganLoadIndicator drugs={drugs} patientInfo={patientInfo} />

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h3 className="typo-section-header mb-3">{t.results.engineScores}</h3>
        <div className="space-y-2.5">
          {engines.map((eng) => (
            <div key={eng.id}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="typo-score text-[11px] text-slate-500">{eng.id}</span>
                  <span className="text-[11px] font-medium text-slate-600">{eng.name}</span>
                </div>
                <span className="typo-score text-[11px] text-slate-400">{eng.weight}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${eng.score > 60 ? 'bg-red-400' : eng.score > 30 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                  style={{ width: `${eng.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClassChip({ label }) {
  return <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{label}</span>;
}

// ── Interaction Card ────────────────────────────────────────────
function InteractionCard({ interaction, index, acknowledged, noted, onAcknowledge, onNote, isFullSystem }) {
  const { t } = useI18n();
  const isMinor = interaction.severity?.label === 'Minor' || interaction.severity?.label === 'Unknown';
  const [expanded, setExpanded] = useState(isMinor ? false : index === 0);
  const [showLiterature, setShowLiterature] = useState(false);
  const severityLabel = interaction.severity?.label;

  const cardBg = () => {
    if (severityLabel === 'Critical') return 'bg-red-50 border-red-200';
    if (severityLabel === 'Moderate') return 'bg-amber-50/60 border-amber-200';
    return 'bg-white border-slate-200';
  };

  const accentBorder = () => {
    if (severityLabel === 'Critical') return 'border-l-[3px] border-l-red-500';
    if (severityLabel === 'Moderate') return 'border-l-[3px] border-l-amber-400';
    return '';
  };

  if (isMinor && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg border transition-all hover:shadow-sm ${cardBg()} ${acknowledged ? 'opacity-60' : ''} animate-stagger-fade-in`}
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <SeverityBadge severity={interaction.severity} />
        <span className="typo-drug-name text-[13px] flex-1 text-left min-w-0 break-words">{interaction.drugA} + {interaction.drugB}</span>
        <span className="text-[11px] text-slate-400 shrink-0 hidden sm:block">{interaction.rule}</span>
        <ChevronDown size={12} className="text-slate-400 shrink-0" />
      </button>
    );
  }

  const recBoxBg = () => {
    if (severityLabel === 'Critical') return 'bg-red-100/70 border-red-200';
    if (severityLabel === 'Moderate') return 'bg-amber-100/50 border-amber-200';
    return 'bg-blue-50 border-blue-100';
  };

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all duration-200 shadow-sm hover:shadow-md ${accentBorder()} ${cardBg()} ${acknowledged ? 'opacity-70' : ''} print-break-inside-avoid animate-stagger-fade-in`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Zone 1: Header */}
      <div className={`px-4 py-3.5 cursor-pointer ${severityLabel === 'Critical' ? 'bg-red-50' : severityLabel === 'Moderate' ? 'bg-amber-50/40' : 'bg-white'}`} onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="typo-drug-name break-words">{interaction.drugA} + {interaction.drugB}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {interaction.drugAClass && <ClassChip label={interaction.drugAClass} />}
              <span className="text-slate-300 text-[10px]">+</span>
              {interaction.drugBClass && <ClassChip label={interaction.drugBClass} />}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SeverityBadge severity={interaction.severity} />
            {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="animate-fade-in">
          {/* Zone 2: Mechanism */}
          <div className="px-4 py-3 bg-white border-t border-slate-100/50">
            <h4 className="typo-section-header text-[11px] mb-1.5">{t.results.whatHappens.toUpperCase()}</h4>
            <p className="typo-body leading-relaxed">{interaction.mechanism}</p>
          </div>

          {/* PK Timeline */}
          {interaction.drugAData && interaction.drugBData && (
            <div className="px-4 py-2 bg-white border-t border-slate-100/50">
              <DrugTimeline drugA={interaction.drugAData} drugB={interaction.drugBData} />
            </div>
          )}

          {/* Zone 3: Recommendation */}
          <div className="px-4 py-3 border-t border-slate-100/50">
            <div className={`rounded-lg border px-3.5 py-3 ${recBoxBg()}`}>
              <h4 className="typo-section-header text-[11px] mb-1.5">{t.results.recommendedAction.toUpperCase()}</h4>
              <p className="typo-rec text-slate-800 leading-relaxed">{interaction.recommendation}</p>

              {interaction.alternativeSuggestion && severityLabel === 'Critical' && (
                <div className="mt-3 pt-2.5 border-t border-slate-200/50">
                  <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5">
                    <Lightbulb size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-0.5">{t.results.alternativeSuggestion}</p>
                      <p className="text-[13px] text-emerald-800 font-medium leading-relaxed">{interaction.alternativeSuggestion}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Literature */}
          {(interaction.literature?.length > 0 || interaction.literatureSummary) && (
            <div className="px-4 pb-3">
              <button
                onClick={(e) => { e.stopPropagation(); setShowLiterature(!showLiterature); }}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
              >
                <BookOpen size={11} />
                {t.results.evidenceRefs}
                {showLiterature ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
              {showLiterature && (
                <div className="mt-2 space-y-2 animate-fade-in">
                  {interaction.literatureSummary && (
                    <p className="typo-body bg-slate-50/80 px-3 py-2 rounded-lg border border-slate-100">{interaction.literatureSummary}</p>
                  )}
                  {interaction.literature.map((ref, i) => (
                    <div key={i} className="text-[11px] text-slate-500 px-2.5 py-1.5 bg-slate-50 rounded">
                      <p className="font-medium text-slate-600">{ref.title}</p>
                      <p className="typo-label">{ref.source}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Acknowledgment row — Full System only */}
          {isFullSystem && (
            <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
              <button
                onClick={(e) => { e.stopPropagation(); onAcknowledge(); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${acknowledged ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'}`}
              >
                <Check size={12} className={acknowledged ? 'text-emerald-600' : 'text-slate-400'} />
                {t.results.reviewed}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onNote(); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${noted ? 'bg-slate-100 text-slate-600 border border-slate-300' : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300'}`}
              >
                <Flag size={10} />
                {t.results.noted}
              </button>
              <span className="text-[10px] text-slate-400 ml-auto italic">{t.results.clinicalJudgment}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Drug Flag Card ──────────────────────────────────────────────
function DrugFlagCard({ drugFlag, species }) {
  const [expanded, setExpanded] = useState(false);
  if (drugFlag.flags.length === 0 && !drugFlag.speciesNote) return null;

  const sourceIcon = () => {
    if (drugFlag.source === DRUG_SOURCE.HUMAN_OFFLABEL) return <FlaskConical size={13} className="text-amber-500" />;
    if (drugFlag.source === DRUG_SOURCE.FOREIGN) return <Globe size={13} className="text-blue-500" />;
    if (drugFlag.source === DRUG_SOURCE.UNKNOWN) return <HelpCircle size={13} className="text-slate-400" />;
    return <Pill size={13} className="text-emerald-500" />;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2.5 text-left">
        {sourceIcon()}
        <span className="text-[13px] font-medium text-slate-800 flex-1 min-w-0 truncate">{drugFlag.drugName}</span>
        {drugFlag.hasSpeciesWarning && (
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full border shrink-0 ${species === 'dog' ? 'border-amber-300 bg-amber-50 text-amber-600' : 'border-violet-300 bg-violet-50 text-violet-600'}`}>
            {species === 'dog' ? '🐕' : '🐈'}
          </span>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          {drugFlag.flags.map((f, i) => (
            <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${f.type === 'off-label' ? 'bg-amber-50 text-amber-600' : f.type === 'foreign' ? 'bg-blue-50 text-blue-600' : f.type === 'mdr1' || f.type === 'nti' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
              {f.label}
            </span>
          ))}
          {expanded ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
        </div>
      </button>
      {expanded && (
        <div className="mt-3 space-y-2 animate-fade-in">
          {drugFlag.flags.map((f, i) => <p key={i} className="typo-body">{f.description}</p>)}
          {drugFlag.speciesNote && (
            <div className="flex items-start gap-1.5 typo-body bg-slate-50 px-2.5 py-2 rounded">
              <Dna size={11} className="text-slate-400 mt-0.5 shrink-0" />
              <p>{drugFlag.speciesNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Action Bar (always visible at bottom of results) ────────────
function ResultsActionBar({ results, patientInfo, drugs, species, lang, t }) {
  const { drugFlags, interactions } = results;

  const handleEmailPrint = () => {
    // Open print dialog — doctor can print-to-PDF and email
    window.print();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm no-print">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle size={15} className="text-emerald-500 shrink-0" />
        <span className="text-[13px] font-semibold text-slate-700">
          {t.results.scanComplete}
        </span>
        <span className="text-[12px] text-slate-400 ml-auto">
          {new Date().toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US')}
          {' · '}{drugFlags.length} {lang === 'ko' ? '종 약물' : 'drugs'}
          {' · '}{interactions.length} {t.results.interactionsFound}
        </span>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={handleEmailPrint}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-700 text-[13px] font-medium rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
        >
          <Printer size={14} />
          {t.results.exportSummary}
        </button>
        <div className="flex-1 flex">
          <ScanExportButton
            results={results}
            patientInfo={patientInfo}
            drugs={drugs}
            species={species}
          />
        </div>
        <button
          onClick={() => {
            const subject = encodeURIComponent(`NUVOVET DUR Report — ${patientInfo?.name || 'Patient'}`);
            const body = encodeURIComponent(
              `DUR Analysis Report\n\nPatient: ${patientInfo?.name || '—'}\nDate: ${new Date().toLocaleDateString()}\nDrugs screened: ${drugFlags.length}\nInteractions found: ${interactions.length}\n\nPlease print the full report for details.`
            );
            window.location.href = `mailto:?subject=${subject}&body=${body}`;
          }}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-[13px] font-medium rounded-lg hover:bg-slate-800 transition-all"
        >
          <Mail size={14} />
          {lang === 'ko' ? '이메일 전송' : 'Send via Email'}
        </button>
      </div>
    </div>
  );
}

// ── Main Results Display ────────────────────────────────────────
export function ResultsDisplay({ results, onBack, onNewAnalysis, patientInfo, isFullSystem = false, drugs = [], species = 'dog' }) {
  const { t, lang } = useI18n();
  if (!results) return null;

  const { interactions, drugFlags, speciesNotes } = results;
  const hasInteractions = interactions.length > 0;
  const flaggedDrugs = drugFlags.filter(f => f.flags.length > 0 || f.speciesNote);

  const [acknowledged, setAcknowledged] = useState({});
  const [noted, setNoted] = useState({});
  const acknowledgedCount = Object.values(acknowledged).filter(Boolean).length;
  const notedCount = Object.values(noted).filter(Boolean).length;
  const allReviewed = interactions.length > 0 && (acknowledgedCount + notedCount) >= interactions.length;
  const [showScanBar, setShowScanBar] = useState(false);

  useEffect(() => {
    if (allReviewed) {
      const timer = setTimeout(() => setShowScanBar(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowScanBar(false);
    }
  }, [allReviewed]);

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 no-print">
          <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h2 className="typo-page-title">{t.results.durReport}</h2>
            <p className="typo-label mt-0.5">
              {new Date(results.timestamp).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Print header */}
        <div className="hidden print-show mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="typo-drug-name">{patientInfo?.name}</p>
              <p className="typo-label">{new Date(results.timestamp).toLocaleDateString()}</p>
            </div>
            <NuvovetLogo size={32} className="text-slate-900" />
          </div>
        </div>

        {/* Two-panel layout */}
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Left sidebar — patient summary */}
          <div className="w-full lg:w-72 xl:w-80 lg:shrink-0">
            <div className="lg:sticky lg:top-20">
              <PatientSummaryPanel results={results} patientInfo={patientInfo} drugs={drugs} species={species} />
            </div>
          </div>

          {/* Right main content */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Prominent severity banner */}
            <SeverityBanner results={results} drugs={drugs} />

            {hasInteractions ? (
              <div>
                <h3 className="typo-section-header mb-3">{t.results.interactionReport}</h3>
                <div className="space-y-3">
                  {interactions.map((interaction, i) => (
                    <InteractionCard
                      key={i}
                      interaction={interaction}
                      index={i}
                      acknowledged={!!acknowledged[i]}
                      noted={!!noted[i]}
                      onAcknowledge={() => setAcknowledged(prev => ({ ...prev, [i]: !prev[i] }))}
                      onNote={() => setNoted(prev => ({ ...prev, [i]: !prev[i] }))}
                      isFullSystem={isFullSystem}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                <CheckCircle size={32} className="text-emerald-500 mx-auto mb-3" />
                <p className="typo-drug-name text-emerald-800 mb-1">{t.results.noInteractions}</p>
                <p className="typo-body text-emerald-600">
                  {lang === 'ko' ? '모든 약물 쌍 검사 완료. 금기사항 없음.' : 'All drug pairs screened. No contraindications detected.'}
                </p>
              </div>
            )}

            {flaggedDrugs.length > 0 && (
              <div>
                <h3 className="typo-section-header mb-3">{t.results.drugAdvisory}</h3>
                <div className="space-y-2">
                  {flaggedDrugs.map((flag, i) => <DrugFlagCard key={i} drugFlag={flag} species={patientInfo?.species} />)}
                </div>
              </div>
            )}

            {speciesNotes.length > 0 && (
              <div>
                <h3 className="typo-section-header mb-3 flex items-center gap-1.5"><Dna size={12} /> {t.results.speciesNotes}</h3>
                <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 shadow-sm">
                  {speciesNotes.map((note, i) => (
                    <div key={i} className="px-4 py-3">
                      <p className="text-[12px] font-medium text-slate-600 mb-0.5">{note.drug}</p>
                      <p className="typo-body">{note.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Always-visible action bar */}
            <ResultsActionBar
              results={results}
              patientInfo={patientInfo}
              drugs={drugs}
              species={species}
              lang={lang}
              t={t}
            />

            <div className="flex gap-3 no-print">
              <button onClick={onBack} className="flex-1 px-4 py-2.5 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">{t.results.backToMeds}</button>
              <button onClick={onNewAnalysis} className="flex-1 px-4 py-2.5 text-[13px] font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm">{t.results.newAnalysis}</button>
            </div>

            <p className="text-[11px] text-slate-400 text-center leading-relaxed pt-1">
              {lang === 'ko' ? '본 분석은 NUVOVET 상호작용 데이터베이스를 기반으로 생성되었으며, 임상적 판단을 대체하지 않습니다.' : 'This analysis is generated from the NUVOVET interaction database and is not a substitute for clinical judgment.'}
            </p>
          </div>
        </div>
      </div>

      {/* Fixed bottom scan bar — shows only after full review in full system */}
      {showScanBar && (
        <div className="fixed bottom-0 left-0 right-0 z-30 no-print animate-slide-up-bar">
          <div className="bg-white border-t border-slate-200 shadow-lg px-4 sm:px-6 py-3">
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                <span className="text-[13px] font-medium text-slate-700 truncate">
                  {t.results.allReviewed} · {drugFlags.length} {lang === 'ko' ? '종 약물' : 'drugs'} · {interactions.length} {t.results.interactionsFound}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 text-[12px] font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                  <Printer size={13} />
                  {t.results.exportSummary}
                </button>
                <ScanExportButton
                  results={results}
                  patientInfo={patientInfo}
                  drugs={drugs}
                  species={species}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
