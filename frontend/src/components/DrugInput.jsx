import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search, X, AlertTriangle, Globe, FlaskConical, HelpCircle,
  Pill, Ban, Loader2,
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

// ── Source icon ────────────────────────────────────────────────
function SourceIcon({ source }) {
  if (source === 'human_offlabel') return <FlaskConical size={13} className="text-amber-500 shrink-0" />;
  if (source === 'foreign') return <Globe size={13} className="text-blue-500 shrink-0" />;
  if (source === 'unknown') return <HelpCircle size={13} className="text-slate-400 shrink-0" />;
  return <Pill size={13} className="text-emerald-500 shrink-0" />;
}

// ── Dose input (Task 3 fix: type=text, inputMode=decimal) ──────
function DoseInput({ value, onChange, placeholder, className }) {
  const [localVal, setLocalVal] = useState(value !== '' && value != null ? String(value) : '');

  useEffect(() => {
    setLocalVal(value !== '' && value != null ? String(value) : '');
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={localVal}
      onChange={(e) => {
        setLocalVal(e.target.value);
        onChange(e.target.value);
      }}
      onBlur={() => {
        const parsed = parseFloat(localVal);
        if (localVal === '' || isNaN(parsed)) {
          setLocalVal('');
          onChange('');
        } else {
          setLocalVal(String(parsed));
          onChange(parsed);
        }
      }}
      placeholder={placeholder}
      className={className}
    />
  );
}

// ── Drug Card (selected drug in prescription list) ─────────────
function DrugCard({ drug, species, weight, onRemove, onUpdateDose }) {
  const hardstop = checkHardstop(drug, species);

  const handleDoseChange = (val) => {
    onUpdateDose(drug.id, { dosePerKg: val });
  };

  return (
    <div className={`bg-white border rounded-xl p-4 shadow-sm ${hardstop ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
      {hardstop && (
        <div className="flex items-start gap-2 mb-3 px-3 py-2 bg-red-100 border border-red-200 rounded-lg">
          <Ban size={13} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-[12px] text-red-800 leading-relaxed font-medium">{hardstop}</p>
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <SourceIcon source={drug.source} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-slate-900 leading-tight">{drug.name}</p>
          {drug.nameKr && (
            <p className="text-[12px] text-slate-500 mt-0.5">{drug.nameKr}</p>
          )}
          {drug.class && (
            <span className="inline-block mt-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              {drug.class}
            </span>
          )}
        </div>
        <button
          onClick={() => onRemove(drug.id)}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {/* Optional dose input */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <DoseInput
            value={drug.dosePerKg || ''}
            onChange={handleDoseChange}
            placeholder="mg/kg"
            className="w-24 px-2.5 py-1.5 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300 transition-all"
          />
          <span className="text-[11px] text-slate-400 leading-relaxed">
            선택 입력 — 입력 시 정밀 분석 적용
          </span>
        </div>
        {drug.dosePerKg && weight > 0 && (
          <p className="mt-1 text-[11px] text-slate-500">
            = {(parseFloat(drug.dosePerKg) * weight).toFixed(2)} mg total ({weight} kg)
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main DrugInput Component ───────────────────────────────────
export function DrugInput({ drugs, onAddDrug, onRemoveDrug, onUpdateDrug, species = 'dog', weight = 0, searchFn }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const selectedIds = new Set(drugs.map((d) => d.id));

  // Debounced search — hits the backend on every keystroke (300ms)
  const handleQueryChange = useCallback((e) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!val.trim()) {
      setResults([]);
      setShowDropdown(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchFn(val, species, 20);
        if (res) {
          setResults(res);
          setShowDropdown(true);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [searchFn, species]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const handleAddDrug = (drug) => {
    if (selectedIds.has(drug.id)) return;
    onAddDrug(drug);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleAddUnknown = () => {
    if (!query.trim()) return;
    const unknown = createUnknownDrug(query.trim());
    if (!selectedIds.has(unknown.id)) {
      onAddDrug(unknown);
    }
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  return (
    <div className="space-y-4">
      {/* Search input — full width, prominent */}
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
          {loading && (
            <Loader2 size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
          )}
        </div>

        {/* Search results dropdown */}
        {showDropdown && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
            {results.length === 0 && !loading && (
              <div className="px-4 py-3 space-y-2">
                <p className="text-[12px] text-slate-400">{t.drugInput.noMatchFound}</p>
                {query.trim() && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); handleAddUnknown(); }}
                    className="text-[12px] text-slate-600 font-medium hover:text-slate-900 transition-colors"
                  >
                    + {t.drugInput.addUnknownDrug.replace('{name}', query.trim())}
                  </button>
                )}
              </div>
            )}

            {results.map((drug) => {
              const isSelected = selectedIds.has(drug.id);
              const hardstop = checkHardstop(drug, species);
              return (
                <button
                  key={drug.id}
                  onMouseDown={(e) => { e.preventDefault(); if (!isSelected) handleAddDrug(drug); }}
                  disabled={isSelected}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-0 transition-colors ${
                    isSelected ? 'bg-slate-50 opacity-60 cursor-default' : 'hover:bg-slate-50'
                  } ${hardstop ? 'bg-red-50' : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5">
                      <SourceIcon source={drug.source} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-slate-900">{drug.name}</span>
                        {drug.nameKr && (
                          <span className="text-[12px] text-slate-500">{drug.nameKr}</span>
                        )}
                      </div>
                      {drug.class && (
                        <span className="text-[10px] font-medium text-slate-400">{drug.class}</span>
                      )}
                      {hardstop && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <AlertTriangle size={10} className="text-red-500" />
                          <span className="text-[10px] text-red-600 font-medium">
                            Species contraindication
                          </span>
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <span className="text-[10px] text-slate-400 shrink-0 self-center">{t.drugInput.selected}</span>
                    )}
                  </div>
                </button>
              );
            })}

            {/* "Add as unknown" option at bottom */}
            {query.trim() && results.length > 0 && (
              <button
                onMouseDown={(e) => { e.preventDefault(); handleAddUnknown(); }}
                className="w-full text-left px-4 py-2.5 text-[12px] text-slate-500 hover:bg-slate-50 transition-colors border-t border-slate-100"
              >
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
              onUpdateDose={(id, patch) => onUpdateDrug(id, patch)}
            />
          ))}
        </div>
      )}

      {drugs.length === 0 && !query && (
        <p className="text-center text-[13px] text-slate-400 py-4">
          {t.fullSystem.addMoreDrugs || '약물을 검색하여 처방을 추가하세요'}
        </p>
      )}
    </div>
  );
}
