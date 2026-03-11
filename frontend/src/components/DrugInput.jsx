import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search, X, Plus, AlertTriangle, Globe, FlaskConical, HelpCircle,
  Pill, Syringe, ChevronDown, Filter, Tag, Ban, Loader2
} from 'lucide-react';
import { searchDrugs, DRUG_SOURCE, DRUG_CLASS, createUnknownDrug } from '../data/drugDatabase';
import {
  buildPrescriptionLineItem,
  calculateDoseMetrics,
  DOSE_UNIT_ENUM,
  ROUTE_ENUM,
  TREATMENT_CATEGORY_ENUM,
} from '../data/emrSchema';
import { listDrugsApi, getDrugByIdApi } from '../lib/api';
import { useI18n } from '../i18n';

// ── Species-Specific Toxicity Hardstops ─────────────────────────
// These are absolute species contraindications — separate from the
// interaction engine.  They fire *immediately* on drug entry, before
// the scan button is clicked.
const SPECIES_HARDSTOPS = {
  cat: {
    // Substance name fragments (lowercase) → human-readable reason
    acetaminophen: 'Acetaminophen (paracetamol) is acutely fatal in cats. Cats lack glucuronyl transferase and cannot metabolise it.',
    paracetamol:   'Paracetamol is acutely fatal in cats. Cats lack glucuronyl transferase and cannot metabolise it.',
    permethrin:    'Permethrin is a potent feline neurotoxin. Even small topical exposures cause seizures and death.',
    ibuprofen:     'Ibuprofen is highly toxic to cats causing acute renal failure and GI perforation.',
    naproxen:      'Naproxen is toxic to cats with a very narrow safety margin — do not use.',
    benzocaine:    'Benzocaine causes methaemoglobinaemia in cats and can be fatal.',
    'tea tree':    'Tea tree oil (melaleuca) is neurotoxic to cats even at low topical doses.',
    melaleuca:     'Melaleuca (tea tree) oil is neurotoxic to cats even at low topical doses.',
    xylitol:       'Xylitol causes hypoglycaemia and acute hepatic failure in cats.',
    aspirin:       'Aspirin has a 44‑hour half-life in cats due to limited glucuronidation — chronic use is toxic.',
  },
  dog: {
    xylitol: 'Xylitol causes severe hypoglycaemia and acute hepatic necrosis in dogs.',
  },
};

function getHardstop(drug, species) {
  const stops = SPECIES_HARDSTOPS[species] ?? {};
  const haystack = [
    drug.name,
    drug.nameKr,
    drug.activeSubstance,
    drug.id,
  ]
    .filter(Boolean)
    .map((s) => s.toLowerCase())
    .join(' ');

  for (const [fragment, reason] of Object.entries(stops)) {
    if (haystack.includes(fragment)) return reason;
  }
  return null;
}

// ── Dose Range Lookup ────────────────────────────────────────────
// Clinical dose *ranges* (min / max mg/kg) for common drugs.
// The database stores a single defaultDose; ranges come from
// published veterinary formulary references.
const DOSE_RANGES = {
  carprofen:      { dog: [2.2, 4.4], cat: null },
  meloxicam:      { dog: [0.1, 0.2], cat: [0.05, 0.05] },
  prednisolone:   { dog: [0.5, 2.0], cat: [0.5, 2.0] },
  metronidazole:  { dog: [10, 25],   cat: [8, 15] },
  amoxicillin:    { dog: [10, 20],   cat: [10, 20] },
  enrofloxacin:   { dog: [5, 10],    cat: [5, 5] },
  gabapentin:     { dog: [5, 10],    cat: [5, 10] },
  tramadol:       { dog: [2, 5],     cat: [2, 4] },
  phenobarbital:  { dog: [2, 5],     cat: [2, 4] },
  cyclosporine:   { dog: [5, 10],    cat: [5, 7.5] },
  atenolol:       { dog: [0.25, 1],  cat: [6.25, 12.5] },  // cat: flat mg
  furosemide:     { dog: [1, 4],     cat: [1, 2] },
  doxycycline:    { dog: [5, 10],    cat: [5, 10] },
  ketoconazole:   { dog: [5, 10],    cat: [5, 10] },
  maropitant:     { dog: [1, 2],     cat: [1, 1] },
  omeprazole:     { dog: [0.7, 1],   cat: [0.7, 1] },
  trazodone:      { dog: [2, 10],    cat: null },
};

function parseStrengthMg(selectedVariant) {
  if (!selectedVariant) return null;
  const m = selectedVariant.match(/^([\d.]+)\s*(mg|mcg|g|ml)/i);
  if (!m) return null;
  const val = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 'g') return val * 1000;
  if (unit === 'mcg') return val / 1000;
  return val; // mg or ml → treat as mg equivalent
}

function DoseCalculator({ drug, species, weight, lang }) {
  const { t } = useI18n();
  if (!weight || weight <= 0) return null;

  const range = DOSE_RANGES[drug.id]?.[species];
  const fallback = drug.defaultDose?.[species];

  if (!range && fallback == null) return null;

  const minDose = range ? range[0] : fallback;
  const maxDose = range ? range[1] : fallback;

  if (minDose == null) return null;

  const minMg = +(minDose * weight).toFixed(1);
  const maxMg = maxDose !== minDose ? +(maxDose * weight).toFixed(1) : null;
  const midMg = maxMg ? +(minMg + (maxMg - minMg) / 2).toFixed(1) : minMg;

  const strengthMg = parseStrengthMg(drug.selectedVariant);

  let tabletsMin = null;
  let tabletsMax = null;
  if (strengthMg && strengthMg > 0) {
    tabletsMin = Math.round((minMg / strengthMg) * 10) / 10;
    tabletsMax = maxMg ? Math.round((maxMg / strengthMg) * 10) / 10 : null;
  }

  const doseLabel = maxMg ? `${minMg}–${maxMg} mg` : `${minMg} mg`;
  const tabletLabel =
    tabletsMin != null
      ? tabletsMax && tabletsMax !== tabletsMin
        ? `${tabletsMin}–${tabletsMax} tabs`
        : `${tabletsMin} tab${tabletsMin !== 1 ? 's' : ''}`
      : null;

  const rangeLabel = maxDose !== minDose ? `${minDose}–${maxDose}` : `${minDose}`;

  // For the visual track: show the full range and mark the calculated zone
  const hasRange = maxMg !== null && maxMg !== minMg;

  return (
    <div className="mt-1.5 pt-2 border-t border-slate-100 space-y-0.5">
      {/* Row 1: context label + calculated dose */}
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] text-slate-400">{t.drugInput.calculatedFor} {weight} kg</span>
        <span className="text-[11px] font-semibold text-slate-800 tabular-nums font-mono">{doseLabel}</span>
      </div>
      {/* Row 2: per-kg rate + tablet count */}
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] text-slate-400 font-mono">{rangeLabel} mg/kg</span>
        {tabletLabel ? (
          <span className="text-[10px] text-slate-500">
            ≈ {tabletLabel}
            {drug.selectedVariant && (
              <span className="text-slate-400"> · {drug.selectedVariant}</span>
            )}
          </span>
        ) : <span />}
      </div>
    </div>
  );
}

// ── Drug class filter groups for doctor workflow ─────────────────
const CLASS_GROUPS = [
  { key: 'all',            classes: [] },
  { key: 'nsaid',          classes: ['NSAID'] },
  { key: 'corticosteroid', classes: ['Corticosteroid'] },
  { key: 'antibiotic',     classes: ['Antibiotic'] },
  { key: 'antifungal',     classes: ['Antifungal'] },
  { key: 'analgesic',      classes: ['Analgesic'] },
  { key: 'cardiac',        classes: ['Cardiac', 'ACE Inhibitor'] },
  { key: 'anticonvulsant', classes: ['Anticonvulsant'] },
  { key: 'gi_protectant',  classes: ['GI Protectant', 'Antiemetic'] },
  { key: 'immunosuppressant', classes: ['Immunosuppressant'] },
  { key: 'other',          classes: ['Diuretic', 'Sedative', 'Antidepressant', 'Thyroid', 'Antiparasitic', 'JAK Inhibitor'] },
];

const ROUTE_FILTERS = ['all', 'PO', 'SC', 'IV', 'Topical'];

// ── Icons & Badges ───────────────────────────────────────────────
function SourceIcon({ source, t }) {
  if (source === DRUG_SOURCE.HUMAN_OFFLABEL) return <FlaskConical size={11} className="text-amber-500 shrink-0" title={t.drugInput.offLabel} />;
  if (source === DRUG_SOURCE.FOREIGN) return <Globe size={11} className="text-blue-500 shrink-0" title={t.drugInput.foreignDrug} />;
  if (source === DRUG_SOURCE.UNKNOWN) return <HelpCircle size={11} className="text-slate-400 shrink-0" />;
  return null;
}

function RouteIcon({ route }) {
  if (!route || route === 'Unknown') return null;
  const r = route.toLowerCase();
  if (r.includes('po') || r === 'oral') return <Pill size={11} className="text-slate-400" />;
  if (r.includes('sc') || r.includes('iv') || r.includes('im') || r.includes('inject')) return <Syringe size={11} className="text-slate-400" />;
  if (r.includes('topical')) return <span className="text-[11px]">🧴</span>;
  return <Pill size={11} className="text-slate-400" />;
}

// ── Drug Card (selected drug in list) ────────────────────────────
function DrugCard({ drug, index, onRemove, onUpdateDrug, species, weight, t, lang }) {
  const lineItem = buildPrescriptionLineItem(drug, weight);
  const isMdr1Risk = drug.mdr1Sensitive && species === 'dog';
  const isNti = drug.narrowTherapeuticIndex;
  const isOffLabel = drug.source === DRUG_SOURCE.HUMAN_OFFLABEL;
  const hardstopReason = getHardstop(drug, species);

  const handleLineChange = (field, value) => {
    if (!onUpdateDrug) return;
    const nextLine = {
      ...lineItem,
      [field]: value,
    };
    const metrics = calculateDoseMetrics({
      dosePerKg: nextLine.dosePerKg,
      doseUnit: nextLine.doseUnit,
      patientWeight: weight,
      daysSupplied: nextLine.daysSupplied,
      timesPerDay: nextLine.timesPerDay,
    });
    onUpdateDrug(drug.id, {
      [field]: value,
      ...metrics,
    });
  };

  return (
    <div
      className={`flex flex-col px-3 py-2.5 border rounded-lg group transition-all ${
        hardstopReason
          ? 'bg-red-50 border-red-300 shadow-sm'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <span className="text-[10px] text-slate-400 font-mono w-4 shrink-0 mt-1">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {hardstopReason
                ? <Ban size={11} className="text-red-500 shrink-0" />
                : <SourceIcon source={drug.source} t={t} />
              }
              <span className={`typo-drug-name text-[14px] truncate ${hardstopReason ? 'text-red-700' : ''}`}>
                {lang === 'ko' && drug.nameKr ? drug.nameKr : drug.name}
              </span>
              {drug.activeSubstance && drug.activeSubstance !== drug.name && drug.activeSubstance !== 'Unknown' && (
                <span className="text-[11px] text-slate-400">({drug.activeSubstance})</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {drug.selectedVariant && (
                <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                  {drug.selectedVariant}
                </span>
              )}
              <div className="flex items-center gap-1">
                <RouteIcon route={drug.route} />
                <span className="text-[10px] text-slate-400">
                  {lang === 'ko' ? (t.routes[drug.route] || drug.route) : drug.route}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                {lang === 'ko' ? (t.drugClasses[drug.class?.toLowerCase()?.replace(/ /g, '_')] || drug.class) : drug.class}
              </span>
              {isOffLabel && (
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">{t.drugInput.offLabel}</span>
              )}
              {isNti && (
                <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">{t.drugInput.nti}</span>
              )}
              {isMdr1Risk && (
                <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">{t.drugInput.mdr1} ⚠</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => onRemove(drug.id)}
          className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5"
          title={t.remove}
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Species hardstop alert ── */}
      {hardstopReason && (
        <div className="mt-2 ml-6 flex items-start gap-1.5 px-2.5 py-2 bg-red-100 border border-red-200 rounded-lg">
          <AlertTriangle size={11} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-700 leading-relaxed font-medium">
            <span className="uppercase tracking-wide text-[10px] block mb-0.5">
              {t.drugInput.speciesContraindication}
            </span>
            {hardstopReason}
          </p>
        </div>
      )}

      {/* ── Dose Weight Calculator ── */}
      {!hardstopReason && (
        <div className="ml-6">
          <DoseCalculator drug={drug} species={species} weight={weight} lang={lang} />

          {/* EMR-style prescription line fields */}
          <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
            <label className="flex flex-col gap-1">
              <span className="text-slate-400">{t.drugInput.dosePerKg}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={lineItem.dosePerKg}
                onChange={(e) => handleLineChange('dosePerKg', Number(e.target.value) || 0)}
                className="px-2 py-1.5 border border-slate-200 rounded-md text-[11px] focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-slate-400">{t.drugInput.doseUnit}</span>
              <select
                value={lineItem.doseUnit}
                onChange={(e) => handleLineChange('doseUnit', e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-md text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                {DOSE_UNIT_ENUM.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-slate-400">{t.drugInput.fieldDays}</span>
              <input
                type="number"
                min="1"
                step="1"
                value={lineItem.daysSupplied}
                onChange={(e) => handleLineChange('daysSupplied', Math.max(1, Number(e.target.value) || 1))}
                className="px-2 py-1.5 border border-slate-200 rounded-md text-[11px] focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-slate-400">{t.drugInput.fieldTimesPerDay}</span>
              <input
                type="number"
                min="1"
                step="1"
                value={lineItem.timesPerDay}
                onChange={(e) => handleLineChange('timesPerDay', Math.max(1, Number(e.target.value) || 1))}
                className="px-2 py-1.5 border border-slate-200 rounded-md text-[11px] focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </label>
          </div>

          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
            <label className="flex flex-col gap-1">
              <span className="text-slate-400">{t.drugInput.route}</span>
              <select
                value={lineItem.route}
                onChange={(e) => handleLineChange('route', e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-md text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                {ROUTE_ENUM.map((route) => (
                  <option key={route} value={route}>{route}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-slate-400">{t.drugInput.folderName}</span>
              <input
                type="text"
                value={lineItem.folderName}
                onChange={(e) => handleLineChange('folderName', e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-md text-[11px] focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-slate-400">{t.drugInput.treatmentCategory}</span>
              <select
                value={lineItem.treatmentCategory}
                onChange={(e) => handleLineChange('treatmentCategory', e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-md text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                {TREATMENT_CATEGORY_ENUM.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-slate-400">{t.drugInput.sellingPrice}</span>
              <input
                type="number"
                min="0"
                step="100"
                value={lineItem.sellingPrice}
                onChange={(e) => handleLineChange('sellingPrice', Math.max(0, Number(e.target.value) || 0))}
                className="px-2 py-1.5 border border-slate-200 rounded-md text-[11px] focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </label>
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-md px-2.5 py-2">
            <span>
              {t.drugInput.calculatedDose}: <span className="font-semibold text-slate-700">{lineItem.calculatedDose_mg.toFixed(2)} mg</span>
            </span>
            <span>
              {t.drugInput.totalDose}: <span className="font-semibold text-slate-700">{lineItem.totalDose_mg.toFixed(2)} mg</span>
            </span>
            <label className="inline-flex items-center gap-1.5 text-slate-500">
              <input
                type="checkbox"
                checked={lineItem.vatApplicable}
                onChange={(e) => handleLineChange('vatApplicable', e.target.checked)}
                className="rounded border-slate-300"
              />
              {t.drugInput.vat}
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main DrugInput Component ─────────────────────────────────────
// searchFn: optional async (query, species) => Drug[]
//   When provided (FullSystem), it replaces the local searchDrugs().
//   When absent (Demo), local static search is used.
export function DrugInput({ drugs, onAddDrug, onRemoveDrug, onUpdateDrug, species, weight = 10, demoMode = false, searchFn = null }) {
  const { t, lang } = useI18n();
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUnknownOption, setShowUnknownOption] = useState(false);
  const [unknownIngredient, setUnknownIngredient] = useState('');
  const [showIngredientInput, setShowIngredientInput] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeClassFilter, setActiveClassFilter] = useState('all');
  const [activeRouteFilter, setActiveRouteFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  // Browse mode state (API-backed when searchFn is provided)
  const [browseDrugList, setBrowseDrugList] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (showSearch && inputRef.current) inputRef.current.focus();
  }, [showSearch]);

  // ── Browse mode: load from backend when search panel opens ─────
  useEffect(() => {
    if (!showSearch || demoMode || !searchFn) return;
    let cancelled = false;
    setBrowseLoading(true);
    setBrowseError(null);
    listDrugsApi({ limit: 50 }).then((data) => {
      if (cancelled) return;
      if (!data || !data.results) {
        setBrowseError('Could not load drug list from server.');
        setBrowseDrugList([]);
      } else {
        setBrowseDrugList(data.results);
      }
      setBrowseLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setBrowseError('Could not load drug list from server.');
        setBrowseLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [showSearch, demoMode, searchFn]);

  // ── Browse mode: filter loaded API drugs by class/route ────────
  const browseDrugs = useMemo(() => {
    if (query.trim().length > 0) return null; // search mode active
    if (demoMode || !searchFn) return null;   // demo uses local search only

    let filtered = browseDrugList;

    // Class filter
    if (activeClassFilter !== 'all') {
      const group = CLASS_GROUPS.find(g => g.key === activeClassFilter);
      if (group) {
        filtered = filtered.filter(d => group.classes.some(c => d.class === c));
      }
    }

    // Route filter
    if (activeRouteFilter !== 'all') {
      filtered = filtered.filter(d =>
        d.route?.toLowerCase().includes(activeRouteFilter.toLowerCase())
      );
    }

    // Exclude already-added drugs
    filtered = filtered.filter(d => !drugs.some(ex => ex.id === d.id));

    return filtered;
  }, [query, demoMode, searchFn, browseDrugList, activeClassFilter, activeRouteFilter, drugs]);

  // ── Search handler ─────────────────────────────────────────────
  const handleSearch = (value) => {
    setQuery(value);
    setSelectedProduct(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      if (value.trim().length >= 1) {
        let found;
        if (searchFn) {
          // API-backed search (FullSystem path) — no local fallback
          const apiResults = await searchFn(value, species);
          if (apiResults === null) {
            // Backend unreachable — show error state, do not fall back
            setResults([]);
            setShowUnknownOption(false);
            setShowDropdown(true);
            setBrowseError('Backend unreachable — drug search unavailable.');
            return;
          }
          found = (apiResults || []).filter(d => !drugs.some(ex => ex.id === d.id));
        } else {
          // Local static search (Demo path)
          found = searchDrugs(value, species).filter(d => !drugs.some(ex => ex.id === d.id));
        }
        setResults(found);
        setShowUnknownOption(value.trim().length >= 2 && found.length === 0);
        setShowDropdown(true);
      } else {
        setResults([]);
        setShowDropdown(false);
        setShowUnknownOption(false);
      }
    }, 300);
  };

  // ── Drug selection: hydrate via ID endpoint (Task 4) ───────────
  const handleSelectDrug = async (drug) => {
    if (searchFn) {
      // Full system path: fetch by ID for deterministic hydration
      const hydrated = await getDrugByIdApi(drug.id);
      if (hydrated === null) {
        setBrowseError(`Could not load drug "${drug.name}" — backend returned 404 or is unreachable.`);
        return;
      }
      const strengths = hydrated.availableStrengths || [];
      if (strengths.length > 1) {
        setSelectedProduct({ drug: hydrated, strengths });
        return;
      }
      const s = strengths[0];
      onAddDrug(buildPrescriptionLineItem({
        ...hydrated,
        selectedVariant: s ? `${s.value}${s.unit}` : null,
      }, weight));
    } else {
      // Demo path: use drug object as-is
      onAddDrug(buildPrescriptionLineItem(drug, weight));
    }
    resetSearch();
  };

  // Select from browse mode (API Drug object → hydrate via ID)
  const handleSelectBrowseDrug = async (drug) => {
    if (searchFn) {
      const hydrated = await getDrugByIdApi(drug.id);
      if (hydrated === null) {
        setBrowseError(`Could not load drug "${drug.name}" — backend returned 404 or is unreachable.`);
        return;
      }
      const strengths = hydrated.availableStrengths || [];
      if (strengths.length > 1) {
        setSelectedProduct({ drug: hydrated, strengths });
        return;
      }
      const s = strengths[0];
      onAddDrug(buildPrescriptionLineItem({
        ...hydrated,
        selectedVariant: s ? `${s.value}${s.unit}` : null,
      }, weight));
      resetSearch();
    }
  };

  const handleSelectVariant = (strength) => {
    if (!selectedProduct) return;
    const { drug } = selectedProduct;
    onAddDrug(buildPrescriptionLineItem({
      ...drug,
      selectedVariant: `${strength.value}${strength.unit}`,
    }, weight));
    resetSearch();
  };

  const resetSearch = () => {
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    setShowUnknownOption(false);
    setSelectedProduct(null);
    setShowSearch(false);
    setActiveClassFilter('all');
    setActiveRouteFilter('all');
    setShowFilters(false);
    setBrowseError(null);
  };

  const handleConfirmUnknown = () => {
    onAddDrug(buildPrescriptionLineItem(createUnknownDrug(query.trim(), unknownIngredient.trim() || null), weight));
    setUnknownIngredient('');
    setShowIngredientInput(false);
    resetSearch();
  };

  // ── Class filter label ─────────────────────────────────────────
  const classLabel = (key) => {
    if (key === 'all') return t.drugInput.allDrugs;
    if (key === 'other') return t.drugInput.otherClass;
    return t.drugClasses[key] || key;
  };

  const routeLabel = (r) => {
    if (r === 'all') return t.drugInput.routeAll;
    return t.routes[r] || r;
  };

  return (
    <div className="space-y-3">
      {/* ── Drug List ── */}
      {drugs.length > 0 && (
        <div className="space-y-2">
          {drugs.map((drug, idx) => (
            <DrugCard
              key={drug.id || idx}
              drug={drug}
              index={idx}
              onRemove={onRemoveDrug}
              onUpdateDrug={onUpdateDrug}
              species={species}
              weight={weight}
              t={t}
              lang={lang}
            />
          ))}
        </div>
      )}

      {/* ── Add Button or Search Panel ── */}
      {!showSearch ? (
        <button
          onClick={() => setShowSearch(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white text-[13px] font-medium rounded-lg hover:bg-slate-800 transition-all duration-200"
        >
          <Plus size={15} />
          {t.drugInput.addMedication}
        </button>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-expand-in">
          {/* ── Search bar ── */}
          <div className="p-3 pb-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => query.trim().length >= 1 && setShowDropdown(true)}
                placeholder={t.drugInput.searchPlaceholder}
                className="w-full pl-9 pr-16 py-2.5 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all placeholder:text-slate-400"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-1 rounded transition-colors ${showFilters ? 'text-slate-900 bg-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                  title={t.drugInput.filterByClass}
                >
                  <Filter size={13} />
                </button>
                <button onClick={resetSearch} className="p-1 text-slate-400 hover:text-slate-600">
                  <X size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Filter bar: class + route ── */}
          {showFilters && (
            <div className="px-3 pb-2 space-y-2 animate-fade-in">
              {/* Class filters */}
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <Tag size={10} className="text-slate-400" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t.drugInput.filterByClass}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {CLASS_GROUPS.map(g => (
                    <button
                      key={g.key}
                      onClick={() => { setActiveClassFilter(g.key); setQuery(''); }}
                      className={`px-2 py-1 text-[10px] font-medium rounded-full border transition-all ${
                        activeClassFilter === g.key
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {classLabel(g.key)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Route filters */}
              <div>
                <div className="flex items-center gap-1 mb-1.5">
                  <Pill size={10} className="text-slate-400" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t.drugInput.filterByRoute}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {ROUTE_FILTERS.map(r => (
                    <button
                      key={r}
                      onClick={() => { setActiveRouteFilter(r); setQuery(''); }}
                      className={`px-2 py-1 text-[10px] font-medium rounded-full border transition-all ${
                        activeRouteFilter === r
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {routeLabel(r)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Variant / strength selector ── */}
          {selectedProduct && (
            <div className="px-3 pb-3 border-t border-slate-100 pt-2 animate-fade-in">
              <p className="text-[11px] text-slate-400 mb-2">
                {lang === 'ko' && selectedProduct.drug.nameKr
                  ? `${selectedProduct.drug.nameKr} — ${t.drugInput.selectStrengthFor}`
                  : `${t.drugInput.selectStrengthFor} ${selectedProduct.drug.name}`}
              </p>
              <div className="flex flex-wrap gap-2">
                {(selectedProduct.strengths || []).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectVariant(s)}
                    className="px-3 py-1.5 text-[12px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100 hover:border-slate-300 transition-all"
                  >
                    {s.value}{s.unit}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Search results (text search mode) ── */}
          {showDropdown && !selectedProduct && query.trim().length > 0 && (
            <div ref={dropdownRef} className="border-t border-slate-100 max-h-64 overflow-y-auto">
              {browseError && results.length === 0 && (
                <div className="px-4 py-4 text-center">
                  <p className="text-[12px] text-red-500 font-medium">{browseError}</p>
                </div>
              )}
              {results.map((drug) => (
                <button
                  key={drug.id}
                  onClick={() => handleSelectDrug(drug)}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                      <RouteIcon route={drug.route} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[13px] font-semibold text-slate-800">
                          {lang === 'ko' && drug.nameKr ? drug.nameKr : drug.name}
                        </span>
                        {lang === 'ko' && drug.name && (
                          <span className="text-[11px] text-slate-400">({drug.name})</span>
                        )}
                        {lang !== 'ko' && drug.activeSubstance && drug.activeSubstance !== drug.name && (
                          <span className="text-[11px] text-slate-400">({drug.activeSubstance})</span>
                        )}
                        <SourceIcon source={drug.source} t={t} />
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {`${lang === 'ko' ? (t.drugClasses[drug.class?.toLowerCase()?.replace(/ /g, '_')] || drug.class) : drug.class} · ${lang === 'ko' ? (t.routes[drug.route] || drug.route) : drug.route}`}
                      </div>
                      {(drug.availableStrengths || []).length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {drug.availableStrengths.slice(0, 4).map((s, i) => (
                            <span key={i} className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                              {s.value}{s.unit}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}

              {showUnknownOption && !showIngredientInput && (
                <button
                  onClick={() => setShowIngredientInput(true)}
                  className="w-full text-left px-3 py-3 hover:bg-slate-50 transition-colors border-t border-slate-100"
                >
                  <div className="flex items-center gap-2 text-slate-500">
                    <AlertTriangle size={14} className="text-amber-500" />
                    <div>
                      <div className="text-[13px] font-medium">
                        {t.drugInput.addUnknownDrug.replace('{name}', query.trim())}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {t.drugInput.notInDatabase}
                      </div>
                    </div>
                  </div>
                </button>
              )}

              {showIngredientInput && (
                <div className="px-3 py-3 border-t border-slate-100 bg-slate-50">
                  <p className="text-[11px] text-slate-500 mb-2">
                    {t.drugInput.optionalIngredient}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={unknownIngredient}
                      onChange={(e) => setUnknownIngredient(e.target.value)}
                      placeholder={t.drugInput.ingredientPlaceholder}
                      className="flex-1 px-2.5 py-2 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      autoFocus
                    />
                    <button onClick={handleConfirmUnknown} className="px-3 py-2 bg-slate-900 text-white text-[11px] font-medium rounded-lg hover:bg-slate-800">
                      {t.add}
                    </button>
                  </div>
                  <button onClick={handleConfirmUnknown} className="mt-1.5 text-[11px] text-slate-400 hover:text-slate-600">
                    {t.drugInput.skipWithoutIngredient}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Browse mode (no search text → show API drug list) ── */}
          {!selectedProduct && query.trim().length === 0 && showSearch && !demoMode && searchFn && (
            <div className="border-t border-slate-100">
              {browseLoading ? (
                <div className="px-4 py-6 text-center flex items-center justify-center gap-2 text-slate-400">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-[12px]">Loading drugs…</span>
                </div>
              ) : browseError && (!browseDrugs || browseDrugs.length === 0) ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-[12px] text-red-500 font-medium">{browseError}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Please check that the backend is running.</p>
                </div>
              ) : browseDrugs && browseDrugs.length > 0 ? (
                <div className="max-h-64 overflow-y-auto">
                  <div className="px-3 pt-2 pb-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      {activeClassFilter !== 'all' || activeRouteFilter !== 'all'
                        ? t.drugInput.filteredResults
                        : t.drugInput.allAvailableDrugs
                      }
                      <span className="ml-1 text-slate-300">({browseDrugs.length})</span>
                    </span>
                  </div>
                  {browseDrugs.map((drug) => (
                    <button
                      key={drug.id}
                      onClick={() => handleSelectBrowseDrug(drug)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                          <RouteIcon route={drug.route} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-semibold text-slate-800 truncate">
                              {lang === 'ko' && drug.nameKr ? drug.nameKr : drug.name}
                            </span>
                            {lang === 'ko' && drug.name && (
                              <span className="text-[10px] text-slate-400 truncate">{drug.name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-slate-400">
                              {lang === 'ko' ? (t.drugClasses[drug.class?.toLowerCase()?.replace(/ /g, '_')] || drug.class) : drug.class}
                            </span>
                            <span className="text-[10px] text-slate-300">·</span>
                            <span className="text-[10px] text-slate-400">
                              {lang === 'ko' ? (t.routes[drug.route] || drug.route) : drug.route}
                            </span>
                            {(drug.dosageForms || []).length > 0 && (
                              <>
                                <span className="text-[10px] text-slate-300">·</span>
                                <span className="text-[10px] text-slate-400">{drug.dosageForms[0]}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {(drug.availableStrengths || []).length > 0 && (
                            <span className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                              {drug.availableStrengths[0].value}{drug.availableStrengths[0].unit}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <p className="text-[12px] text-slate-400">{t.drugInput.noMatchFound}</p>
                  <p className="text-[11px] text-slate-300 mt-1">{t.drugInput.tryDifferentSearch}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {demoMode && drugs.length === 0 && (
        <p className="text-[11px] text-slate-400 text-center">{t.demo.addAtLeast2}</p>
      )}
    </div>
  );
}
