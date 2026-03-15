import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Lock, Eye, EyeOff, Zap, RotateCcw,
  ChevronDown, ChevronUp, Plus, X, Camera, Users, Save,
  CheckCircle, AlertCircle,
} from 'lucide-react';
import { NuvovetWordmark } from '../components/NuvovetLogo';
import { useI18n, LangToggle } from '../i18n';
import { DrugInput } from '../components/DrugInput';
import { AnalysisScreen } from '../components/AnalysisScreen';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { runFullDURAnalysis } from '../utils/durEngine';
import { searchDrugsApi, isBackendAvailable, getBreedsApi, getConditionsApi, getAllergiesApi } from '../lib/api';
import { EMRImportModal } from '../components/EMRImportModal';
import { searchPatients, savePatient, addVisitRecord } from '../lib/patientStorage';

const SYSTEM_PASSWORD = 'vetdur2025';

// ── Decimal number input (Task 3) ────────────────────────────────
// Stores empty string while mid-edit, coerces on blur.
function DecimalInput({ value, onChange, onBlur, placeholder, className, min, max }) {
  const [localVal, setLocalVal] = useState(value !== 0 && value !== null && value !== undefined ? String(value) : '');

  // Sync if parent changes value from outside (e.g. patient load)
  useEffect(() => {
    setLocalVal(value !== 0 && value !== null && value !== undefined ? String(value) : '');
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={localVal}
      onChange={(e) => {
        setLocalVal(e.target.value);
        // Pass raw string to parent while editing
        onChange(e.target.value);
      }}
      onBlur={() => {
        // Coerce on blur
        const parsed = parseFloat(localVal);
        if (localVal === '' || isNaN(parsed)) {
          setLocalVal('');
          onChange('');
        } else {
          let coerced = parsed;
          if (min !== undefined && coerced < min) coerced = min;
          if (max !== undefined && coerced > max) coerced = max;
          setLocalVal(String(coerced));
          onChange(coerced);
        }
        onBlur?.();
      }}
      placeholder={placeholder}
      className={className}
    />
  );
}

// ── Searchable tag input ──────────────────────────────────────────
function TagInput({ items, onAdd, onRemove, placeholder, chipClass, suggestions = [] }) {
  const [value, setValue] = useState('');
  const [showSug, setShowSug] = useState(false);

  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(value.toLowerCase()) && !items.includes(s)
  );

  const handleAdd = (item) => {
    const trimmed = (item || value).trim();
    if (trimmed && !items.includes(trimmed)) {
      onAdd(trimmed);
      setValue('');
      setShowSug(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {items.map((item) => (
            <span
              key={item}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${chipClass}`}
            >
              {item}
              <button onClick={() => onRemove(item)} className="hover:opacity-70 ml-0.5">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setShowSug(true); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            onFocus={() => setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all placeholder:text-slate-300 bg-white"
          />
          <button
            onMouseDown={(e) => { e.preventDefault(); handleAdd(); }}
            className="px-3 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors flex items-center"
          >
            <Plus size={13} />
          </button>
        </div>
        {showSug && filtered.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
            {filtered.slice(0, 8).map((s) => (
              <button
                key={s}
                onMouseDown={(e) => { e.preventDefault(); handleAdd(s); }}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Searchable breed input with MDR1 indicator ─────────────────
function BreedInput({ value, onChange, species }) {
  const [input, setInput] = useState(value || '');
  const [showSug, setShowSug] = useState(false);
  const [breedList, setBreedList] = useState([]);

  useEffect(() => { setInput(value || ''); }, [value]);

  useEffect(() => {
    getBreedsApi(species).then((breeds) => setBreedList(breeds)).catch(() => {});
  }, [species]);

  const filtered = breedList.filter(
    (b) => b.breed.toLowerCase().includes(input.toLowerCase()) && b.breed !== input
  );

  const handleSelect = (breed) => {
    setInput(breed);
    onChange(breed);
    setShowSug(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={input}
        onChange={(e) => { setInput(e.target.value); onChange(e.target.value); setShowSug(true); }}
        onFocus={() => setShowSug(true)}
        onBlur={() => setTimeout(() => setShowSug(false), 150)}
        placeholder={species === 'dog' ? '예: 푸들, 말티즈, Poodle...' : '예: 페르시안, Russian Blue...'}
        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300 transition-all"
      />
      {showSug && (input.length > 0 || filtered.length > 0) && filtered.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {filtered.slice(0, 10).map((b) => (
            <button
              key={b.breed}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(b.breed); }}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between"
            >
              <span>{b.breed}</span>
              {b.mdr1 && (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0 ml-2">
                  ⚠ MDR1
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Password Gate ─────────────────────────────────────────────────
function PasswordGate({ onAuthenticate }) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === SYSTEM_PASSWORD) {
      onAuthenticate();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.07)]">
        <div className="max-w-5xl mx-auto px-6 h-[62px] flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 -ml-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <NuvovetWordmark />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="max-w-sm w-full text-center">
          <div className="mx-auto w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
            <Lock size={24} className="text-slate-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">{t.fullSystem.accessTitle}</h2>
          <p className="text-sm text-slate-500 mb-8">{t.fullSystem.accessDesc}</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.fullSystem.passwordPlaceholder}
                className={`w-full px-4 py-3 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-all pr-10 ${
                  error
                    ? 'border-red-300 focus:ring-red-100 bg-red-50'
                    : 'border-slate-200 focus:ring-slate-900/10 focus:border-slate-300'
                }`}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && (
              <p className="text-xs text-red-500">{t.fullSystem.invalidPassword}</p>
            )}
            <button
              type="submit"
              className="w-full px-4 py-3 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-all duration-200"
            >
              {t.fullSystem.enterSystem}
            </button>
          </form>
          <button
            onClick={() => navigate('/demo')}
            className="mt-6 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            {t.fullSystem.tryDemoInstead}
          </button>
        </div>
      </main>
    </div>
  );
}

// ── Full System Main ──────────────────────────────────────────────
export default function FullSystem() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const [authenticated, setAuthenticated] = useState(false);

  // ── Patient state ─────────────────────────────────────────────
  const [patientId, setPatientId] = useState(null);
  const [patientName, setPatientName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [species, setSpecies] = useState(null); // null = not yet selected
  const [weight, setWeight] = useState('');
  const [sex, setSex] = useState('Unknown');
  const [breed, setBreed] = useState('');

  // Additional details (collapsed by default)
  const [ageYears, setAgeYears] = useState('');
  const [conditions, setConditions] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [creatinine, setCreatinine] = useState('');
  const [alt, setAlt] = useState('');
  const [additionalOpen, setAdditionalOpen] = useState(false);

  // ── Drug state ────────────────────────────────────────────────
  const [drugs, setDrugs] = useState([]);

  // ── Patient lookup state ──────────────────────────────────────
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSuggestions, setPatientSuggestions] = useState([]);
  const [showPatientList, setShowPatientList] = useState(false);
  const [saveProfileChecked, setSaveProfileChecked] = useState(false);

  // ── Condition/allergy suggestions from backend ────────────────
  const [conditionSuggestions, setConditionSuggestions] = useState([]);
  const [allergySuggestions, setAllergySuggestions] = useState([]);

  // ── UI state ──────────────────────────────────────────────────
  const [showEMRModal, setShowEMRModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importBanner, setImportBanner] = useState(false);
  const [importedFields, setImportedFields] = useState(new Set());

  // ── Flow state ────────────────────────────────────────────────
  const [step, setStep] = useState('input');
  const [results, setResults] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const pollRef = useRef(null);
  const debounceRef = useRef(null);
  const searchDebounceRef = useRef(null);

  // ── Backend polling ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const ok = await isBackendAvailable();
      if (!cancelled) setIsConnected(ok);
    };
    check();
    pollRef.current = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(pollRef.current); };
  }, []);

  // ── Load condition/allergy suggestions from backend ──────────
  useEffect(() => {
    getConditionsApi().then(setConditionSuggestions).catch(() => {});
    getAllergiesApi().then(setAllergySuggestions).catch(() => {});
  }, []);

  // ── Patient search debounce ───────────────────────────────────
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!patientSearch.trim()) { setPatientSuggestions([]); return; }
    searchDebounceRef.current = setTimeout(() => {
      setPatientSuggestions(searchPatients(patientSearch));
    }, 150);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [patientSearch]);

  // ── Auto-rerun on detail changes ─────────────────────────────
  useEffect(() => {
    if (step !== 'results' || drugs.length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const weightNum = typeof weight === 'number' ? weight : parseFloat(weight) || 0;
    debounceRef.current = setTimeout(() => {
      const newResults = runFullDURAnalysis(drugs, species, weightNum);
      newResults.wasRefined = true;
      setResults(newResults);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [breed, sex, ageYears, conditions, allergies, creatinine, alt]);

  // ── Drug callbacks ────────────────────────────────────────────
  const handleAddDrug = useCallback((drug) => setDrugs((prev) => [...prev, drug]), []);
  const handleRemoveDrug = useCallback((drugId) => setDrugs((prev) => prev.filter((d) => d.id !== drugId)), []);
  const handleUpdateDrug = useCallback(
    (drugId, patch) => setDrugs((prev) => prev.map((d) => d.id === drugId ? { ...d, ...patch } : d)),
    [],
  );

  if (!authenticated) return <PasswordGate onAuthenticate={() => setAuthenticated(true)} />;

  // ── Handlers ──────────────────────────────────────────────────
  const weightNum = typeof weight === 'number' ? weight : parseFloat(weight) || 0;
  const canRun = species && weightNum > 0 && drugs.length > 0;

  const handleSelectPatient = (p) => {
    setPatientId(p.id);
    setPatientName(p.name || '');
    setOwnerPhone(p.owner_phone || '');
    setSpecies(p.species || 'dog');
    setWeight(p.weight_kg != null ? String(p.weight_kg) : '');
    setBreed(p.breed || '');
    setSex(p.sex || 'Unknown');
    setAgeYears(p.age_years != null ? String(p.age_years) : '');
    setConditions(p.conditions || []);
    setAllergies(p.allergies || []);
    setCreatinine(p.creatinine_mg_dL != null ? String(p.creatinine_mg_dL) : '');
    setAlt(p.alt_u_L != null ? String(p.alt_u_L) : '');
    setPatientSearch(p.name || '');
    setShowPatientList(false);
  };

  const handleRunAnalysis = () => {
    if (!canRun) return;
    if (saveProfileChecked) {
      handleSavePatient();
    }
    setStep('analyzing');
  };

  const handleAnalysisComplete = () => {
    const analysisResults = runFullDURAnalysis(drugs, species, weightNum);
    setResults(analysisResults);
    setStep('results');
  };

  const handleSavePatient = () => {
    const profile = savePatient({
      id: patientId || undefined,
      name: patientName || '환자',
      owner_phone: ownerPhone || null,
      species: species || 'dog',
      breed: breed || null,
      weight_kg: weightNum || null,
      sex: sex !== 'Unknown' ? sex : null,
      age_years: ageYears ? parseFloat(ageYears) : null,
      allergies,
      conditions,
      creatinine_mg_dL: creatinine ? parseFloat(creatinine) : null,
      alt_u_L: alt ? parseFloat(alt) : null,
    });
    setPatientId(profile.id);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleUpdatePatientRecord = () => {
    if (!patientId || !results) return;
    addVisitRecord(patientId, {
      date: new Date().toISOString(),
      drugs: drugs.map((d) => d.id),
      dur_summary: results?.overallSeverity?.label || 'Unknown',
    });
    handleSavePatient();
  };

  const handleImportComplete = (data, drugObjects) => {
    const filled = new Set();
    if (data.patient_name) { setPatientName(data.patient_name); filled.add('name'); }
    if (data.owner_phone) { setOwnerPhone(data.owner_phone); filled.add('phone'); }
    if (data.species === 'dog' || data.species === 'cat') { setSpecies(data.species); filled.add('species'); }
    if (data.breed) { setBreed(data.breed); filled.add('breed'); }
    if (data.weight_kg != null) { setWeight(String(data.weight_kg)); filled.add('weight'); }
    if (data.sex) { setSex(data.sex); filled.add('sex'); }
    if (data.age_years != null) { setAgeYears(String(data.age_years)); filled.add('age'); }
    if (data.conditions?.length) { setConditions(data.conditions); filled.add('conditions'); }
    if (data.allergies?.length) { setAllergies(data.allergies); filled.add('allergies'); }
    if (data.creatinine_mg_dL != null) { setCreatinine(String(data.creatinine_mg_dL)); filled.add('creatinine'); }
    if (data.alt_u_L != null) { setAlt(String(data.alt_u_L)); filled.add('alt'); }
    if (drugObjects?.length) {
      setDrugs((prev) => {
        const existingIds = new Set(prev.map((d) => d.id));
        const newDrugs = drugObjects.filter((d) => !existingIds.has(d.id));
        return [...prev, ...newDrugs];
      });
    }
    setImportedFields(filled);
    setImportBanner(true);
    setAdditionalOpen(true);
  };

  const handleReset = () => {
    setPatientId(null);
    setPatientName('');
    setOwnerPhone('');
    setSpecies(null);
    setWeight('');
    setSex('Unknown');
    setBreed('');
    setAgeYears('');
    setConditions([]);
    setAllergies([]);
    setCreatinine('');
    setAlt('');
    setAdditionalOpen(false);
    setDrugs([]);
    setResults(null);
    setStep('input');
    setPatientSearch('');
    setSaveProfileChecked(false);
    setImportBanner(false);
    setImportedFields(new Set());
    setSaveSuccess(false);
  };

  const creatVal = parseFloat(creatinine);
  const patientInfo = {
    name: patientName,
    species,
    breed,
    weight: weightNum,
    sex: sex !== 'Unknown' ? sex : undefined,
    age: ageYears ? `${ageYears}y` : undefined,
    conditions,
    allergies,
    flaggedLabs: creatinine && creatVal > 1.4
      ? [{ key: 'creatinine', value: creatinine, unit: 'mg/dL', status: 'high' }]
      : creatinine && creatVal > 0
      ? [{ key: 'creatinine', value: creatinine, unit: 'mg/dL', status: 'normal' }]
      : [],
  };

  const SEX_OPTIONS = [
    { value: 'Intact Male',   label: t.fullSystem.sexIntactMale },
    { value: 'Intact Female', label: t.fullSystem.sexIntactFemale },
    { value: 'Neutered Male', label: t.fullSystem.sexNeuteredMale },
    { value: 'Spayed Female', label: t.fullSystem.sexSpayedFemale },
  ];

  const fieldHighlight = (field) =>
    importedFields.has(field) ? 'ring-2 ring-indigo-300 ring-offset-1' : '';

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">

      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.07)] shrink-0">
        <div className="px-4 sm:px-6 h-[58px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <NuvovetWordmark />
              <span className="hidden sm:inline text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
                {t.fullSystemLabel}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/patients')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <Users size={14} />
              {t.fullSystem.patientsNav}
            </button>
            <LangToggle />
            {step === 'input' && (drugs.length > 0 || patientName) && (
              <button
                onClick={handleReset}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                title={t.reset}
              >
                <RotateCcw size={14} />
              </button>
            )}
            {isConnected ? (
              <span className="text-[11px] px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full font-semibold flex items-center gap-1.5 border border-emerald-100">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                {t.connected}
              </span>
            ) : (
              <span className="text-[11px] px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full font-semibold flex items-center gap-1.5 border border-slate-200">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                Offline
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Save toast */}
      {saveSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-slate-800 text-white text-sm font-medium rounded-xl shadow-lg animate-fade-in flex items-center gap-2">
          <CheckCircle size={15} className="text-emerald-400" />
          {t.fullSystem.patientSaved}
        </div>
      )}

      {/* EMR Modal */}
      {showEMRModal && (
        <EMRImportModal
          onClose={() => setShowEMRModal(false)}
          onImport={handleImportComplete}
          species={species}
          t={t}
        />
      )}

      {/* Body */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* ANALYZING */}
        {step === 'analyzing' && (
          <AnalysisScreen
            onComplete={handleAnalysisComplete}
            drugCount={drugs.length}
            species={species}
          />
        )}

        {/* INPUT */}
        {step === 'input' && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-xl mx-auto px-4 py-8 space-y-8">

              {/* ── SECTION 1: PATIENT DETAILS ───────────────────────── */}
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{t.fullSystem.sectionPatient}</h2>
                  <p className="text-[13px] text-slate-400 mt-0.5">{t.fullSystem.sectionPatientHint}</p>
                </div>

                {/* EMR Import — prominent secondary action at top */}
                <button
                  onClick={() => setShowEMRModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 border-2 border-dashed border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all bg-white"
                >
                  <Camera size={16} className="text-slate-400" />
                  {t.fullSystem.importFromEMR}
                </button>

                {/* Import banner */}
                {importBanner && (
                  <div className="flex items-start gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <AlertCircle size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-indigo-800">{t.fullSystem.importBannerTitle}</p>
                      <p className="text-[12px] text-indigo-600 mt-0.5">{t.fullSystem.importBannerDesc}</p>
                    </div>
                    <button onClick={() => setImportBanner(false)} className="text-indigo-400 hover:text-indigo-600">
                      <X size={15} />
                    </button>
                  </div>
                )}

                {/* Returning patient search */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    {t.fullSystem.returningPatient}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={patientSearch}
                      onChange={(e) => { setPatientSearch(e.target.value); setShowPatientList(true); }}
                      onFocus={() => setShowPatientList(true)}
                      onBlur={() => setTimeout(() => setShowPatientList(false), 200)}
                      placeholder={t.fullSystem.searchPatientPlaceholder}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 bg-white placeholder:text-slate-300 transition-all"
                    />
                    {showPatientList && patientSearch.trim() && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                        {patientSuggestions.length === 0 ? (
                          <div className="px-4 py-3 text-[12px] text-slate-400">{t.fullSystem.noSavedPatients}</div>
                        ) : (
                          patientSuggestions.slice(0, 6).map((p) => (
                            <button
                              key={p.id}
                              onMouseDown={(e) => { e.preventDefault(); handleSelectPatient(p); }}
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                            >
                              <div className="text-sm font-medium text-slate-800">{p.name}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {p.species === 'dog' ? '개' : '고양이'}
                                {p.weight_kg ? ` · ${p.weight_kg} kg` : ''}
                                {p.visit_history?.[0]?.date
                                  ? ` · ${p.visit_history[0].date.split('T')[0]}`
                                  : p.updated_at ? ` · ${p.updated_at.split('T')[0]}` : ''}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Patient name / owner phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      {t.fullSystem.patientNameLabel}
                    </label>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder={t.fullSystem.patientNamePlaceholder}
                      className={`w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300 transition-all ${fieldHighlight('name')}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      {t.fullSystem.ownerPhoneLabel}
                    </label>
                    <input
                      type="text"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      placeholder="010-0000-0000"
                      className={`w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300 transition-all ${fieldHighlight('phone')}`}
                    />
                  </div>
                </div>

                {/* Species toggle */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    {t.fullSystem.speciesToggleLabel}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['dog', 'cat'] ).map((sp) => (
                      <button
                        key={sp}
                        onClick={() => setSpecies(sp)}
                        className={`py-4 rounded-xl border-2 font-semibold text-sm transition-all ${
                          species === sp
                            ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        } ${fieldHighlight('species')}`}
                      >
                        {sp === 'dog' ? '개 / Canine' : '고양이 / Feline'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fields revealed after species selection */}
                <div
                  className={`space-y-4 overflow-hidden transition-all duration-300 ${
                    species ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  {/* Breed */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      {t.fullSystem.breedLabel}
                    </label>
                    <div className={fieldHighlight('breed') ? `rounded-lg ${fieldHighlight('breed')}` : ''}>
                      <BreedInput value={breed} onChange={setBreed} species={species || 'dog'} />
                    </div>
                  </div>

                  {/* Weight */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      {t.fullSystem.weightLabel}
                    </label>
                    <div className="flex items-center gap-2">
                      <DecimalInput
                        value={weight}
                        onChange={setWeight}
                        placeholder={t.fullSystem.weightPlaceholder}
                        min={0.01}
                        max={200}
                        className={`flex-1 px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300 transition-all ${fieldHighlight('weight')}`}
                      />
                      <span className="text-sm text-slate-400 font-medium shrink-0">kg</span>
                    </div>
                  </div>

                  {/* Sex */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      {t.fullSystem.sexLabel}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {SEX_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setSex(sex === opt.value ? 'Unknown' : opt.value)}
                          className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                            sex === opt.value
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          } ${fieldHighlight('sex')}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Additional details toggle */}
                  <div>
                    <button
                      onClick={() => setAdditionalOpen((v) => !v)}
                      className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      {additionalOpen
                        ? <ChevronUp size={15} className="text-slate-400" />
                        : <ChevronDown size={15} className="text-slate-400" />}
                      {t.fullSystem.addPatientDetails}
                    </button>

                    <div
                      className={`space-y-4 overflow-hidden transition-all duration-300 ${
                        additionalOpen ? 'max-h-[2000px] opacity-100 mt-4' : 'max-h-0 opacity-0'
                      }`}
                    >
                      {/* Age */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                          {t.fullSystem.ageLabel}
                        </label>
                        <DecimalInput
                          value={ageYears}
                          onChange={setAgeYears}
                          placeholder={t.fullSystem.agePlaceholder}
                          min={0}
                          max={30}
                          className={`w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300 transition-all ${fieldHighlight('age')}`}
                        />
                      </div>

                      {/* Allergies */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                          알레르기 / Allergies
                        </label>
                        <TagInput
                          items={allergies}
                          onAdd={(a) => setAllergies((prev) => [...prev, a])}
                          onRemove={(a) => setAllergies((prev) => prev.filter((x) => x !== a))}
                          placeholder="예: Penicillin, NSAIDs..."
                          chipClass="bg-amber-50 text-amber-700 border border-amber-100"
                          suggestions={allergySuggestions}
                        />
                      </div>

                      {/* Conditions */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                          기저 질환 / Conditions
                        </label>
                        <TagInput
                          items={conditions}
                          onAdd={(c) => setConditions((prev) => [...prev, c])}
                          onRemove={(c) => setConditions((prev) => prev.filter((x) => x !== c))}
                          placeholder="예: CKD, Diabetes..."
                          chipClass="bg-red-50 text-red-700 border border-red-100"
                          suggestions={conditionSuggestions}
                        />
                      </div>

                      {/* Creatinine */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          {t.fullSystem.creatinineLabel}
                          <span className="normal-case font-normal text-slate-300 ml-1">{t.fullSystem.creatinineUnit}</span>
                        </label>
                        <DecimalInput
                          value={creatinine}
                          onChange={setCreatinine}
                          placeholder="예: 1.2"
                          min={0}
                          className={`w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300 transition-all ${fieldHighlight('creatinine')}`}
                        />
                        {creatinine && parseFloat(creatinine) > 1.4 && (
                          <p className="text-[11px] text-amber-600 font-medium">{t.fullSystem.creatinineIrisHint}</p>
                        )}
                      </div>

                      {/* ALT */}
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          {t.fullSystem.altLabel}
                          <span className="normal-case font-normal text-slate-300 ml-1">{t.fullSystem.altUnit}</span>
                        </label>
                        <DecimalInput
                          value={alt}
                          onChange={setAlt}
                          placeholder="예: 45"
                          min={0}
                          className={`w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300 transition-all ${fieldHighlight('alt')}`}
                        />
                        <p className="text-[11px] text-slate-400">{t.fullSystem.altHint}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── DIVIDER ──────────────────────────────────────────── */}
              <div className="border-t border-slate-100" />

              {/* ── SECTION 2: DRUG PRESCRIPTION ─────────────────────── */}
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{t.fullSystem.sectionDrugs}</h2>
                  <p className="text-[13px] text-slate-400 mt-0.5">{t.fullSystem.sectionDrugsHint}</p>
                </div>

                <DrugInput
                  drugs={drugs}
                  onAddDrug={handleAddDrug}
                  onRemoveDrug={handleRemoveDrug}
                  onUpdateDrug={handleUpdateDrug}
                  species={species || 'dog'}
                  weight={weightNum}
                  searchFn={searchDrugsApi}
                />
              </div>

              {/* ── DIVIDER ──────────────────────────────────────────── */}
              <div className="border-t border-slate-100" />

              {/* ── SECTION 3: RUN DUR ───────────────────────────────── */}
              <div className="space-y-4 pb-8">
                {/* Save patient checkbox */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={saveProfileChecked}
                    onChange={(e) => setSaveProfileChecked(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-slate-800 focus:ring-slate-500"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">
                    {t.fullSystem.saveProfileLabel}
                  </span>
                </label>

                <button
                  onClick={handleRunAnalysis}
                  disabled={!canRun}
                  className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                >
                  <Zap size={15} />
                  {t.fullSystem.runDurCheck}
                  {drugs.length >= 1 && (
                    <span className="ml-1 text-slate-400 text-xs font-normal">
                      · {drugs.length} {t.results.drugCountLabel}
                    </span>
                  )}
                </button>
                {!canRun && (
                  <p className="text-center text-[12px] text-slate-400">
                    {t.fullSystem.runDurDisabledHint}
                  </p>
                )}
              </div>

            </div>
          </div>
        )}

        {/* RESULTS */}
        {step === 'results' && (
          <div className="flex-1 overflow-y-auto">
            <ResultsDisplay
              results={results}
              onBack={() => setStep('input')}
              onNewAnalysis={() => {
                setDrugs([]);
                setResults(null);
                setStep('input');
              }}
              isFullSystem
              drugs={drugs}
              species={species}
              patientInfo={patientInfo}
              onUpdatePatientRecord={patientId ? handleUpdatePatientRecord : null}
            />
          </div>
        )}

      </div>
    </div>
  );
}
