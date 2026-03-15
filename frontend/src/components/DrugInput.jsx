import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search, X, AlertTriangle, Globe, FlaskConical, HelpCircle,
  Pill, Ban, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { createUnknownDrug } from '../data/drugDatabase';
import { useI18n } from '../i18n';

// ── Species-Specific Toxicity Hardstops ─────────────────────────
const SPECIES_HARDSTOPS = {
  cat: {
    acetaminophen: 'Acetaminophen (paracetamol) is acutely fatal in cats. Cats lack glucuronyl transferase and cannot metabolise it.',
    paracetamol:   'Paracetamol is acutely fatal in cats. Cats lack glucuronyl transferase and cannot metabolise it.',
    permethrin:    'Permethrin is a potent feline neurotoxin. Even small topical exposures cause seizures and death.',
    ibuprofen:     'Ibuprofen is highly toxic to cats causing acute renal failure and GI perforation.',
    naproxen:      'Naproxen is toxic to cats with a very narrow safety margin — do not use.',
    benzocaine:    'Benzocaine causes methaemoglobinaemia in cats and can be fatal.',
    'tea tree':    'Tea tree oil (melaleuca) is neurotoxic to cats even at low topical doses.',
    melaleuca:     'Melaleuca (tea tree) oil is neurotoxic to cats.',
    xylitol:       'Xylitol causes severe hypoglycaemia and liver failure.',
    'onion':       'Onion/garlic compounds cause Heinz body haemolytic anaemia in cats.',
    'garlic':      'Garlic compounds cause Heinz body haemolytic anaemia in cats.',
  },
  dog: {
    xylitol:   'Xylitol causes severe hypoglycaemia and acute hepatic necrosis in dogs.',
    grapes:    'Grapes/raisins cause acute renal failure in dogs via an unknown mechanism.',
    raisins:   'Raisins cause acute renal failure in dogs via an unknown mechanism.',
    macadamia: 'Macadamia nuts cause tremors and hyperthermia in dogs.',
  },
};

function checkHardstop(drug, species) {
  const checks = SPECIES_HARDSTOPS[species] || {};
  const nameStr = `${drug.name || ''} ${drug.activeSubstance || ''} ${(drug.brandNames || []).join(' ')}`.toLowerCase();
  for (const [fragment, reason] of Object.entries(checks)) {
    if (nameStr.includes(fragment)) return reason;
  }
  return null;
}

// ── Source icon ─────────────────────────────────────────────────
function SourceIcon({ source }) {
  if (source === 'human_offlabel') return <FlaskConical size={13} className="text-amber-500 shrink-0" />;
  if (source === 'foreign') return <Globe size={13} className="text-blue-500 shrink-0" />;
  if (source === 'unknown') return <HelpCircle size={13} className="text-slate-400 shrink-0" />;
  return <Pill size={13} className="text-emerald-500 shrink-0" />;
}

// ── Dose Input ──────────────────────────────────────────────────
function DoseInput({ value, onChange, placeholder, className }) {
  const [localVal, setLocalVal] = useState(value !== '' && value != null ? String(value) : '');
  useEffect(() => { setLocalVal(value !== '' && value != null ? String(value) : ''); }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={localVal}
      onChange={(e) => { setLocalVal(e.target.value); onChange(e.target.value); }}
      onBlur={() => {
        const parsed = parseFloat(localVal);
        if (localVal === '' || isNaN(parsed)) { setLocalVal(''); onChange(''); }
        else { setLocalVal(String(parsed)); onChange(parsed); }
      }}
      placeholder={placeholder}
      className={className}
    />
  );
}

// ── Get dose status ─────────────────────────────────────────────
function getDoseStatus(doseNum, range) {
  if (!doseNum || !range || !Array.isArray(range) || range.length < 2) return null;
  if (doseNum < range[0]) return 'below';
  if (doseNum > range[1]) return 'above';
  return 'within';
}

// ── Drug Card ───────────────────────────────────────────────────
function DrugCard({ drug, species, weight, onRemove, onUpdateDrug }) {
  const hardstop = checkHardstop(drug, species);

  // Formulation state
  const strengths = drug.availableStrengths || [];
  const [selectedStrengthIdx, setSelectedStrengthIdx] = useState(
    drug._selectedStrengthIdx ?? 0
  );
  const selectedStrength = strengths[selectedStrengthIdx] || null;

  // Route state
  const ROUTE_OPTIONS = ['PO', 'IV', 'IM', 'SC', 'Topical', 'Intranasal', 'Ophthalmic', 'Other'];
  const [route, setRoute] = useState(drug.route || 'PO');

  // Frequency
  const FREQ_OPTIONS = ['SID', 'BID', 'TID', 'QID', 'q8h', 'q12h', 'PRN', 'Other'];
  const [freq, setFreq] = useState(drug.freq || 'SID');

  // Duration
  const [duration, setDuration] = useState(drug.prescriptionDays || 7);

  // Dose state — pre-fill with species default
  const defaultDose = drug.defaultDose?.[species] || '';
  const [dosePerKg, setDosePerKg] = useState(
    drug.dosePerKg !== undefined && drug.dosePerKg !== '' ? drug.dosePerKg : defaultDose
  );

  // Expanded state
  const [expanded, setExpanded] = useState(true);

  // Compute dose info
  const doseNum = parseFloat(dosePerKg) || 0;
  const weightNum = parseFloat(weight) || 0;
  const totalDoseMg = doseNum > 0 && weightNum > 0 ? +(doseNum * weightNum) : null;
  const range = drug.doseRange?.[species];
  const doseStatus = doseNum > 0 ? getDoseStatus(doseNum, range) : null;

  // Tablets / volume needed
  const tabletsNeeded = totalDoseMg && selectedStrength
    ? +(totalDoseMg / selectedStrength.value).toFixed(2)
    : null;

  // Push updates to parent whenever key state changes
  useEffect(() => {
    onUpdateDrug(drug.id, {
      dosePerKg: doseNum || '',
      route,
      freq,
      prescriptionDays: duration,
      doseStatus,
      _selectedStrengthIdx: selectedStrengthIdx,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dosePerKg, route, freq, duration, selectedStrengthIdx]);

  const inputBorderClass = doseStatus === 'above'
    ? 'border-red-400 focus:ring-red-200'
    : doseStatus === 'below'
    ? 'border-orange-400 focus:ring-orange-200'
    : 'border-slate-200 focus:ring-slate-900/10';

  return (
    <div className={`bg-white border rounded-xl shadow-sm overflow-hidden ${hardstop ? 'border-red-300' : doseStatus === 'above' ? 'border-red-200' : doseStatus === 'below' ? 'border-orange-200' : 'border-slate-200'}`}>

      {/* Hardstop banner */}
      {hardstop && (
        <div className="flex items-start gap-2 px-4 py-2.5 bg-red-100 border-b border-red-200">
          <Ban size={13} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-[12px] text-red-800 leading-relaxed font-medium">{hardstop}</p>
        </div>
      )}

      {/* Drug header */}
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-2">
        <div className="mt-0.5"><SourceIcon source={drug.source} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-slate-900 leading-tight">{drug.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {drug.nameKr && <span className="text-[11px] text-slate-400">{drug.nameKr}</span>}
            {drug.class && <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{drug.class}</span>}
            {drug.activeSubstance && drug.activeSubstance !== drug.name && (
              <span className="text-[10px] text-slate-400">{drug.activeSubstance}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setExpanded(v => !v)}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={() => onRemove(drug.id)}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Dose summary bar (always visible) */}
      {!expanded && (doseNum > 0 || totalDoseMg) && (
        <div className={`px-4 pb-3 flex items-center gap-3 text-[12px] ${doseStatus === 'above' ? 'text-red-700' : doseStatus === 'below' ? 'text-orange-700' : 'text-slate-600'}`}>
          {doseNum > 0 && <span className="font-semibold">{doseNum} mg/kg</span>}
          {totalDoseMg && <span>= <span className="font-semibold">{totalDoseMg.toFixed(2)} mg</span></span>}
          {doseStatus === 'above' && <span className="font-medium">↑ Above range</span>}
          {doseStatus === 'below' && <span className="font-medium">↓ Below range</span>}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">

          {/* Formulations */}
          {strengths.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Formulation</label>
              <div className="flex flex-wrap gap-1.5">
                {strengths.map((s, idx) => (
                  <button key={idx} onClick={() => setSelectedStrengthIdx(idx)}
                    className={`px-2.5 py-1 text-[12px] font-medium rounded-lg border transition-all ${
                      selectedStrengthIdx === idx
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}>
                    {s.value} {s.unit}
                  </button>
                ))}
                {drug.dosageForms?.length > 0 && (
                  <span className="px-2 py-1 text-[11px] text-slate-400 bg-slate-50 rounded-lg border border-slate-100">
                    {drug.dosageForms.join(', ')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Route */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Route</label>
            <select value={route} onChange={e => setRoute(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white text-slate-700">
              {ROUTE_OPTIONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>

          {/* Dose input + calculation summary */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Dose</label>
            <div className="flex gap-3 items-start">
              {/* Dose input */}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <DoseInput
                    value={dosePerKg}
                    onChange={(v) => setDosePerKg(v)}
                    placeholder={range ? `${range[0]}–${range[1]} mg/kg` : 'mg/kg'}
                    className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 bg-white placeholder:text-slate-300 transition-all ${inputBorderClass}`}
                  />
                  <span className="text-[12px] text-slate-400 shrink-0">mg/kg</span>
                </div>
                {/* Warning messages */}
                {doseStatus === 'above' && range && (
                  <p className="text-[11px] text-red-600 font-medium flex items-center gap-1">
                    <AlertTriangle size={11} />
                    Exceeds recommended range ({range[0]}–{range[1]} mg/kg)
                  </p>
                )}
                {doseStatus === 'below' && range && (
                  <p className="text-[11px] text-orange-600 font-medium flex items-center gap-1">
                    <AlertTriangle size={11} />
                    Below recommended range ({range[0]}–{range[1]} mg/kg)
                  </p>
                )}
                {range && !doseStatus && (
                  <p className="text-[11px] text-slate-400">Recommended: {range[0]}–{range[1]} mg/kg</p>
                )}
              </div>

              {/* Dose calculation summary box */}
              {(totalDoseMg || doseNum > 0) && (
                <div className={`rounded-xl p-3 min-w-[110px] text-center border ${
                  doseStatus === 'above' ? 'bg-red-50 border-red-200' :
                  doseStatus === 'below' ? 'bg-orange-50 border-orange-200' :
                  doseStatus === 'within' ? 'bg-emerald-50 border-emerald-200' :
                  'bg-slate-50 border-slate-200'
                }`}>
                  {totalDoseMg != null ? (
                    <>
                      <div className={`text-[18px] font-bold leading-tight ${
                        doseStatus === 'above' ? 'text-red-700' :
                        doseStatus === 'below' ? 'text-orange-700' :
                        doseStatus === 'within' ? 'text-emerald-700' :
                        'text-slate-800'
                      }`}>
                        {totalDoseMg.toFixed(totalDoseMg < 1 ? 3 : totalDoseMg < 10 ? 2 : 1)} mg
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Total dose</div>
                      {tabletsNeeded && (
                        <>
                          <div className="text-[13px] font-semibold text-slate-700 mt-1.5">{tabletsNeeded} tabs</div>
                          <div className="text-[10px] text-slate-400">× {selectedStrength.value} {selectedStrength.unit}</div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="text-[11px] text-slate-400">Enter weight to calculate</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Frequency + Duration */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Frequency</label>
              <select value={freq} onChange={e => setFreq(e.target.value)}
                className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white text-slate-700">
                {FREQ_OPTIONS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Duration (days)</label>
              <input
                type="number"
                value={duration}
                onChange={e => setDuration(parseInt(e.target.value) || 1)}
                min={1}
                max={365}
                className="w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white text-slate-700"
              />
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ── Main DrugInput Component ────────────────────────────────────
export function DrugInput({ drugs, onAddDrug, onRemoveDrug, onUpdateDrug, species = 'dog', weight = 0, searchFn }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const selectedIds = new Set(drugs.map((d) => d.id));

  const handleQueryChange = useCallback((e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setResults([]); setShowDropdown(false); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchFn(val, species, 20);
        if (res) { setResults(res); setShowDropdown(true); }
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  }, [searchFn, species]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleAddDrug = (drug) => {
    if (selectedIds.has(drug.id)) return;
    onAddDrug(drug);
    setQuery(''); setResults([]); setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleAddUnknown = () => {
    if (!query.trim()) return;
    const unknown = createUnknownDrug(query.trim());
    if (!selectedIds.has(unknown.id)) onAddDrug(unknown);
    setQuery(''); setResults([]); setShowDropdown(false);
  };

  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="relative">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            placeholder={t.drugInput.searchPlaceholder}
            className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 bg-white placeholder:text-slate-300 transition-all"
          />
          {loading && <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
            {results.length === 0 && !loading && (
              <div className="px-4 py-3 space-y-2">
                <p className="text-[12px] text-slate-400">{t.drugInput.noMatchFound}</p>
                {query.trim() && (
                  <button onMouseDown={(e) => { e.preventDefault(); handleAddUnknown(); }}
                    className="text-[12px] text-slate-600 font-medium hover:text-slate-900 transition-colors">
                    + {t.drugInput.addUnknownDrug.replace('{name}', query.trim())}
                  </button>
                )}
              </div>
            )}
            {results.map((drug) => {
              const isSelected = selectedIds.has(drug.id);
              const hardstop = checkHardstop(drug, species);
              const range = drug.doseRange?.[species];
              return (
                <button key={drug.id}
                  onMouseDown={(e) => { e.preventDefault(); if (!isSelected) handleAddDrug(drug); }}
                  disabled={isSelected}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-0 transition-colors ${isSelected ? 'bg-slate-50 opacity-60 cursor-default' : 'hover:bg-slate-50'} ${hardstop ? 'bg-red-50/50' : ''}`}>
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5"><SourceIcon source={drug.source} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-slate-900">{drug.name}</span>
                        {drug.nameKr && <span className="text-[12px] text-slate-500">{drug.nameKr}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {drug.class && <span className="text-[10px] font-medium text-slate-400">{drug.class}</span>}
                        {range && <span className="text-[10px] text-slate-400">{range[0]}–{range[1]} mg/kg</span>}
                        {hardstop && (
                          <span className="flex items-center gap-1 text-[10px] text-red-600 font-medium">
                            <AlertTriangle size={10} /> Species contraindication
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && <span className="text-[10px] text-slate-400 shrink-0 self-center">{t.drugInput.selected}</span>}
                  </div>
                </button>
              );
            })}
            {query.trim() && results.length > 0 && (
              <button onMouseDown={(e) => { e.preventDefault(); handleAddUnknown(); }}
                className="w-full text-left px-4 py-2.5 text-[12px] text-slate-500 hover:bg-slate-50 transition-colors border-t border-slate-100">
                + {t.drugInput.addUnknownDrug.replace('{name}', query.trim())}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Selected drug cards */}
      {drugs.length > 0 && (
        <div className="space-y-3">
          {drugs.map((drug) => (
            <DrugCard
              key={drug.id}
              drug={drug}
              species={species}
              weight={weight}
              onRemove={onRemoveDrug}
              onUpdateDrug={onUpdateDrug}
            />
          ))}
        </div>
      )}

      {drugs.length === 0 && !query && (
        <p className="text-center text-[13px] text-slate-400 py-6">
          {t.fullSystem.addMoreDrugs || 'Search and add drugs to start your prescription'}
        </p>
      )}
    </div>
  );
}
