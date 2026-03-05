import React, { useState } from 'react';
import {
  AlertTriangle, AlertCircle, Info, CheckCircle, ChevronDown, ChevronUp,
  BookOpen, FlaskConical, Globe, HelpCircle, Dna, Shield, ArrowLeft,
  Check, Lightbulb, FileText, Clock, Pill
} from 'lucide-react';
import { SeverityBadge } from './SeverityBadge';
import { DRUG_SOURCE } from '../data/drugDatabase';
import { DrugTimeline } from './DrugTimeline';

// ── Summary Band ──────────────────────────────────────────────
function SummaryBand({ results }) {
  const { interactions, drugFlags, overallSeverity, confidenceScore } = results;
  const criticalCount = interactions.filter(i => i.severity.label === 'Critical').length;
  const moderateCount = interactions.filter(i => i.severity.label === 'Moderate').length;
  const minorCount = interactions.filter(i => i.severity.label === 'Minor' || i.severity.label === 'Unknown').length;
  const drugCount = drugFlags.length;

  const severityBg = () => {
    if (overallSeverity.label === 'Critical') return 'bg-red-50 border-red-200';
    if (overallSeverity.label === 'Moderate') return 'bg-amber-50 border-amber-200';
    if (overallSeverity.label === 'Minor') return 'bg-yellow-50 border-yellow-200';
    return 'bg-emerald-50 border-emerald-200';
  };

  const severityIcon = () => {
    if (overallSeverity.label === 'Critical') return <AlertTriangle size={22} className="text-red-600" />;
    if (overallSeverity.label === 'Moderate') return <AlertCircle size={22} className="text-amber-600" />;
    if (overallSeverity.label === 'Minor') return <Info size={22} className="text-yellow-600" />;
    return <CheckCircle size={22} className="text-emerald-600" />;
  };

  const confidenceColor = () => {
    if (confidenceScore >= 85) return { bar: 'bg-emerald-500', text: 'text-emerald-700', label: 'High' };
    if (confidenceScore >= 60) return { bar: 'bg-amber-500', text: 'text-amber-700', label: 'Moderate' };
    return { bar: 'bg-red-500', text: 'text-red-700', label: 'Low' };
  };

  const conf = confidenceColor();

  return (
    <div className={`border rounded-xl overflow-hidden ${severityBg()}`}>
      {/* Top row: severity + counts */}
      <div className="px-4 py-4 flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{severityIcon()}</div>
        <div className="flex-1 min-w-0">
          <p className={`text-base font-bold ${
            overallSeverity.label === 'Critical' ? 'text-red-800' :
            overallSeverity.label === 'Moderate' ? 'text-amber-800' :
            overallSeverity.label === 'Minor' ? 'text-yellow-800' :
            'text-emerald-800'
          }`}>
            {overallSeverity.label === 'None'
              ? 'No Significant Interactions Detected'
              : `${interactions.length} Interaction${interactions.length !== 1 ? 's' : ''} Found`}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs text-slate-500 bg-white/60 px-2 py-0.5 rounded-full border border-slate-200/60">
              {drugCount} drugs screened
            </span>
            {criticalCount > 0 && (
              <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                {criticalCount} Critical
              </span>
            )}
            {moderateCount > 0 && (
              <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                {moderateCount} Moderate
              </span>
            )}
            {minorCount > 0 && (
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                {minorCount} Minor
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="px-4 pb-4">
        <div className="bg-white/70 rounded-lg px-3 py-2.5 border border-white/40">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Analysis Confidence</span>
            <span className={`text-sm font-bold ${conf.text}`}>{confidenceScore}% — {conf.label}</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${conf.bar} rounded-full transition-all duration-1000 ease-out`}
              style={{ width: `${confidenceScore}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Drug Class Chip ──────────────────────────────────────────
function ClassChip({ label }) {
  return (
    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
      {label}
    </span>
  );
}

// ── Interaction Card ────────────────────────────────────────────
function InteractionCard({ interaction, index, acknowledged, onAcknowledge }) {
  const isMinor = interaction.severity?.label === 'Minor' || interaction.severity?.label === 'Unknown';
  const [expanded, setExpanded] = useState(isMinor ? false : index === 0);
  const [showLiterature, setShowLiterature] = useState(false);

  const severityLabel = interaction.severity?.label;

  // Card background by severity
  const cardBg = () => {
    if (severityLabel === 'Critical') return 'bg-red-50 border-red-200';
    if (severityLabel === 'Moderate') return 'bg-amber-50/60 border-amber-200';
    return 'bg-white border-slate-200';
  };

  const severityIcon = () => {
    if (severityLabel === 'Critical') return <AlertTriangle size={16} className="text-red-500" />;
    if (severityLabel === 'Moderate') return <AlertCircle size={16} className="text-amber-500" />;
    if (severityLabel === 'Minor') return <Info size={16} className="text-yellow-500" />;
    if (severityLabel === 'Unknown') return <HelpCircle size={16} className="text-slate-400" />;
    return <CheckCircle size={16} className="text-emerald-500" />;
  };

  // Minor interactions: compact single-line view
  if (isMinor && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg border transition-all hover:bg-slate-50 ${cardBg()} ${acknowledged ? 'opacity-60' : ''}`}
      >
        {severityIcon()}
        <SeverityBadge severity={interaction.severity} />
        <span className="text-sm text-slate-700 flex-1 text-left truncate">
          {interaction.drugA} + {interaction.drugB}
        </span>
        <span className="text-xs text-slate-400">{interaction.rule}</span>
        <ChevronDown size={12} className="text-slate-400 shrink-0" />
      </button>
    );
  }

  // Recommendation box tint
  const recBoxBg = () => {
    if (severityLabel === 'Critical') return 'bg-red-100/70 border-red-200';
    if (severityLabel === 'Moderate') return 'bg-amber-100/50 border-amber-200';
    return 'bg-slate-50 border-slate-200';
  };

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200 ${cardBg()} ${acknowledged ? 'opacity-70' : ''}`}>
      {/* Zone 1: Header — Drug pair + class chips */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-white/30 transition-colors"
      >
        <div className="mt-0.5 shrink-0">{severityIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <SeverityBadge severity={interaction.severity} />
            <span className="text-xs text-slate-400">{interaction.rule}</span>
          </div>
          <p className="text-sm font-bold text-slate-900">
            {interaction.drugA} + {interaction.drugB}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            {interaction.drugAClass && <ClassChip label={interaction.drugAClass} />}
            <span className="text-slate-300 text-xs">+</span>
            {interaction.drugBClass && <ClassChip label={interaction.drugBClass} />}
          </div>
        </div>
        <div className="shrink-0 mt-1 text-slate-400">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Zone 2 + 3: Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 animate-fade-in border-t border-slate-100/50 pt-3">
          {/* Zone 2: Mechanism */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mechanism</h4>
            <p className="text-sm text-slate-700 leading-relaxed">{interaction.mechanism}</p>
          </div>

          {/* Drug Timeline */}
          {interaction.drugAData && interaction.drugBData && (
            <DrugTimeline drugA={interaction.drugAData} drugB={interaction.drugBData} />
          )}

          {/* Zone 3: Action Box — Recommendation */}
          <div className={`rounded-lg border px-3.5 py-3 ${recBoxBg()}`}>
            <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Pill size={10} />
              Clinical Recommendation
            </h4>
            <p className="text-sm text-slate-700 leading-relaxed">{interaction.recommendation}</p>

            {/* Alternative suggestion for Critical */}
            {interaction.alternativeSuggestion && (
              <div className="mt-2 pt-2 border-t border-slate-200/50 flex items-start gap-2">
                <Lightbulb size={13} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-0.5">Alternative Approach</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{interaction.alternativeSuggestion}</p>
                </div>
              </div>
            )}
          </div>

          {/* Literature — expandable */}
          {(interaction.literature?.length > 0 || interaction.literatureSummary) && (
            <div>
              <button
                onClick={(e) => { e.stopPropagation(); setShowLiterature(!showLiterature); }}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
              >
                <BookOpen size={11} />
                Evidence & References
                {showLiterature ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>

              {showLiterature && (
                <div className="mt-2 space-y-2 animate-fade-in">
                  {interaction.literatureSummary && (
                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/80 px-3 py-2 rounded-lg border border-slate-100">
                      {interaction.literatureSummary}
                    </p>
                  )}
                  {interaction.literature.map((ref, i) => (
                    <div key={i} className="text-xs text-slate-500 px-2.5 py-1.5 bg-slate-50 rounded">
                      <p className="font-medium text-slate-600">{ref.title}</p>
                      <p className="text-slate-400">{ref.source}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Acknowledged button */}
          <button
            onClick={(e) => { e.stopPropagation(); onAcknowledge(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              acknowledged
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <Check size={12} className={acknowledged ? 'text-emerald-600' : 'text-slate-400'} />
            {acknowledged ? 'Acknowledged' : 'Mark as Acknowledged'}
          </button>
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
    return <Shield size={13} className="text-emerald-500" />;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 text-left"
      >
        {sourceIcon()}
        <span className="text-sm font-medium text-slate-800 flex-1">{drugFlag.drugName}</span>
        {/* Species badge */}
        {drugFlag.hasSpeciesWarning && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full border ${
            species === 'dog'
              ? 'border-amber-300 bg-amber-50 text-amber-600'
              : 'border-violet-300 bg-violet-50 text-violet-600'
          }`}>
            {species === 'dog' ? '🐕' : '🐈'}
          </span>
        )}
        <div className="flex items-center gap-1.5">
          {drugFlag.flags.map((f, i) => (
            <span key={i} className={`text-xs px-1.5 py-0.5 rounded ${
              f.type === 'off-label' ? 'bg-amber-50 text-amber-600' :
              f.type === 'foreign' ? 'bg-blue-50 text-blue-600' :
              f.type === 'unknown' ? 'bg-slate-100 text-slate-500' :
              f.type === 'species-warning' ? 'bg-red-50 text-red-600' :
              f.type === 'mdr1' ? 'bg-red-50 text-red-600' :
              'bg-slate-100 text-slate-500'
            }`}>
              {f.label}
            </span>
          ))}
          {expanded ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 animate-fade-in">
          {drugFlag.flags.map((f, i) => (
            <p key={i} className="text-xs text-slate-500 leading-relaxed">{f.description}</p>
          ))}
          {drugFlag.speciesNote && (
            <div className="flex items-start gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-2 rounded">
              <Dna size={11} className="text-slate-400 mt-0.5 shrink-0" />
              <p>{drugFlag.speciesNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Scan Summary Card ──────────────────────────────────────────
function ScanSummaryCard({ results, patientInfo, acknowledgedCount, totalInteractions }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center gap-2">
        <FileText size={13} className="text-slate-500" />
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Scan Summary</span>
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {patientInfo?.name && (
            <>
              <span className="text-slate-400">Patient</span>
              <span className="text-slate-700 font-medium">{patientInfo.name}</span>
            </>
          )}
          {patientInfo?.species && (
            <>
              <span className="text-slate-400">Species</span>
              <span className="text-slate-700 font-medium capitalize">{patientInfo.species === 'dog' ? 'Canine' : 'Feline'}</span>
            </>
          )}
          <span className="text-slate-400">Date</span>
          <span className="text-slate-700 font-medium">
            {new Date(results.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
          <span className="text-slate-400">Drugs Screened</span>
          <span className="text-slate-700 font-medium">{results.drugFlags.length}</span>
          <span className="text-slate-400">Interactions Found</span>
          <span className="text-slate-700 font-medium">{results.interactions.length}</span>
          {results.interactions.length > 0 && (
            <>
              <span className="text-slate-400">Severity Breakdown</span>
              <span className="text-slate-700 font-medium">
                {results.interactions.filter(i => i.severity.label === 'Critical').length > 0 &&
                  `${results.interactions.filter(i => i.severity.label === 'Critical').length} critical`}
                {results.interactions.filter(i => i.severity.label === 'Moderate').length > 0 &&
                  `${results.interactions.filter(i => i.severity.label === 'Critical').length > 0 ? ', ' : ''}${results.interactions.filter(i => i.severity.label === 'Moderate').length} moderate`}
                {results.interactions.filter(i => i.severity.label === 'Minor').length > 0 &&
                  `${(results.interactions.filter(i => i.severity.label === 'Critical').length + results.interactions.filter(i => i.severity.label === 'Moderate').length) > 0 ? ', ' : ''}${results.interactions.filter(i => i.severity.label === 'Minor').length} minor`}
              </span>
            </>
          )}
          <span className="text-slate-400">Acknowledgment</span>
          <span className="text-slate-700 font-medium">
            {acknowledgedCount} of {totalInteractions} reviewed
          </span>
        </div>
      </div>
      <div className="px-4 py-2 bg-slate-100/50 border-t border-slate-200">
        <p className="text-[10px] text-slate-400">
          VetDUR Scan Report — Confidence: {results.confidenceScore}%
        </p>
      </div>
    </div>
  );
}

// ── Main Results Display ────────────────────────────────────────
export function ResultsDisplay({ results, onBack, onNewAnalysis, patientInfo }) {
  if (!results) return null;

  const { interactions, drugFlags, overallSeverity, confidenceScore, speciesNotes } = results;
  const hasInteractions = interactions.length > 0;
  const flaggedDrugs = drugFlags.filter(f => f.flags.length > 0 || f.speciesNote);

  // Track acknowledged state per interaction
  const [acknowledged, setAcknowledged] = useState({});
  const acknowledgedCount = Object.values(acknowledged).filter(Boolean).length;

  const handleAcknowledge = (index) => {
    setAcknowledged(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">DUR Analysis Report</h2>
          <p className="text-xs text-slate-400">
            {new Date(results.timestamp).toLocaleString('en-US', {
              year: 'numeric', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit'
            })}
          </p>
        </div>
      </div>

      {/* Summary Band */}
      <SummaryBand results={results} />

      {/* Interactions */}
      {hasInteractions && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Interaction Report
          </h3>
          <div className="space-y-2">
            {interactions.map((interaction, i) => (
              <InteractionCard
                key={i}
                interaction={interaction}
                index={i}
                acknowledged={!!acknowledged[i]}
                onAcknowledge={() => handleAcknowledge(i)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Drug Flags */}
      {flaggedDrugs.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Drug Advisory Flags
          </h3>
          <div className="space-y-2">
            {flaggedDrugs.map((flag, i) => (
              <DrugFlagCard key={i} drugFlag={flag} species={patientInfo?.species} />
            ))}
          </div>
        </div>
      )}

      {/* Species Notes */}
      {speciesNotes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Dna size={12} />
            Species-Specific Notes
          </h3>
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {speciesNotes.map((note, i) => (
              <div key={i} className="px-4 py-3">
                <p className="text-xs font-medium text-slate-600 mb-0.5">{note.drug}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{note.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scan Summary Card */}
      <ScanSummaryCard
        results={results}
        patientInfo={patientInfo}
        acknowledgedCount={acknowledgedCount}
        totalInteractions={interactions.length}
      />

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Modify Prescription
        </button>
        <button
          onClick={onNewAnalysis}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
        >
          New Analysis
        </button>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-slate-400 text-center leading-relaxed pt-2">
        This analysis is generated from the VetDUR interaction database and is not a substitute for clinical judgment.
        Always verify critical interactions with current literature and consult a veterinary pharmacologist for complex cases.
      </p>
    </div>
  );
}
