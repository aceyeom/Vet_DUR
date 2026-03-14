import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Lock, Eye, EyeOff, Zap, RotateCcw,
  ChevronDown, Plus, X, Camera,
} from 'lucide-react';
import { NuvovetWordmark } from '../components/NuvovetLogo';
import { useI18n, LangToggle } from '../i18n';
import { DrugInput } from '../components/DrugInput';
import { AnalysisScreen } from '../components/AnalysisScreen';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { runFullDURAnalysis } from '../utils/durEngine';
import { searchDrugsApi, isBackendAvailable } from '../lib/api';

const SYSTEM_PASSWORD = 'vetdur2025';

// ── Korean breed suggestions ────────────────────────────────────────────────

const KOREAN_BREEDS_DOG = [
  '말티즈', '푸들', '비숑프리제', '포메라니안', '치와와', '시추', '요크셔테리어',
  '골든리트리버', '래브라도리트리버', '보더콜리', '웰시코기', '비글', '닥스훈트',
  '프렌치불독', '퍼그', '사모예드', '진돗개', '풍산개', '스피츠', '미니핀',
];
const KOREAN_BREEDS_CAT = [
  '코리안숏헤어', '페르시안', '샴', '러시안블루', '메인쿤', '스코티시폴드',
  '아비시니안', '벵갈', '버만', '노르웨이숲고양이', '브리티시숏헤어',
];

// ── Conditions / Allergies suggestions ─────────────────────────────────────

const COMMON_CONDITIONS = [
  'Hip Dysplasia', 'Chronic Kidney Disease (CKD)', 'Hypertrophic Cardiomyopathy (HCM)',
  'Hyperthyroidism', 'Hypothyroidism', 'Diabetes Mellitus', 'Atopic Dermatitis',
  'IVDD – Intervertebral Disc Disease', 'Epilepsy', 'Inflammatory Bowel Disease (IBD)',
  'FLUTD', 'Pancreatitis', 'Hepatic Lipidosis', 'Anemia', 'Hypertension',
  'Congestive Heart Failure (CHF)', 'Chronic Otitis Externa', 'MDR1 Deficient',
  'Brachycephalic Syndrome', 'Dental Disease', 'Obesity', 'Anxiety / Behavioral',
  'Early Stage Renal Failure (IRIS 2)', 'Lymphoma', 'Osteosarcoma', 'Osteoarthritis',
];

const COMMON_ALLERGIES = [
  'Penicillin', 'Sulfonamides', 'Cephalosporins', 'Metronidazole',
  'NSAIDs', 'Aspirin', 'Beef', 'Chicken', 'Dairy', 'Wheat', 'Soy',
];

// ── Tag Input ─────────────────────────────────────────────────────────────────

function TagInput({ items, onAdd, onRemove, placeholder, chipClass, suggestions = [] }) {
  const [value, setValue] = useState('');
  const [showSug, setShowSug] = useState(false);

  const filtered = suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && !items.includes(s));

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
          {items.map(item => (
            <span key={item} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${chipClass}`}>
              {item}
              <button onClick={() => onRemove(item)} className="hover:opacity-70 ml-0.5">
                <X size={9} />
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
            onChange={e => { setValue(e.target.value); setShowSug(true); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            onFocus={() => setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            placeholder={placeholder}
            className="flex-1 px-2.5 py-1.5 text-[11px] border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all placeholder:text-slate-300 bg-white"
          />
          <button
            onMouseDown={e => { e.preventDefault(); handleAdd(); }}
            className="px-2.5 py-1.5 bg-slate-800 text-white text-[10px] rounded-md hover:bg-slate-700 transition-colors flex items-center"
          >
            <Plus size={11} />
          </button>
        </div>
        {showSug && filtered.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
            {filtered.slice(0, 5).map(s => (
              <button
                key={s}
                onMouseDown={e => { e.preventDefault(); handleAdd(s); }}
                className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50 transition-colors"
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

// ── EMR Import Modal ───────────────────────────────────────────────────────────

function EMRImportModal({ onClose, t }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-slate-500" />
            <h3 className="text-base font-semibold text-slate-800">{t.fullSystem.importModalTitle}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center gap-3 bg-slate-50 cursor-pointer hover:border-slate-300 hover:bg-slate-100 transition-colors">
          <Camera size={32} className="text-slate-300" />
          <p className="text-sm text-slate-500 text-center">{t.fullSystem.importDragDrop}</p>
        </div>

        <p className="mt-4 text-[11px] text-slate-400 text-center leading-relaxed">
          {t.fullSystem.importModalDesc}
        </p>

        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
        >
          {t.fullSystem.importClose}
        </button>
      </div>
    </div>
  );
}

// ── Refinement Panel ──────────────────────────────────────────────────────────

function RefinementPanel({
  t, lang,
  breed, setBreed,
  sex, setSex,
  ageYears, setAgeYears,
  conditions, setConditions,
  allergies, setAllergies,
  creatinine, setCreatinine,
  alt, setAlt,
  species,
  onSave,
  stage2Open, setStage2Open,
}) {
  const breedSuggestions = species === 'dog' ? KOREAN_BREEDS_DOG : KOREAN_BREEDS_CAT;
  const [breedInput, setBreedInput] = useState(breed);
  const [showBreedSug, setShowBreedSug] = useState(false);

  const filteredBreeds = breedSuggestions.filter(
    b => b.toLowerCase().includes(breedInput.toLowerCase()) && b !== breedInput
  );

  const SEX_OPTIONS = [
    { value: 'Intact Male',   label: t.fullSystem.sexIntactMale },
    { value: 'Intact Female', label: t.fullSystem.sexIntactFemale },
    { value: 'Neutered Male', label: t.fullSystem.sexNeuteredMale },
    { value: 'Spayed Female', label: t.fullSystem.sexSpayedFemale },
  ];

  const creatVal = parseFloat(creatinine);
  const showIrisHint = creatinine && creatVal > 1.4;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
      {/* Header — acts as accordion toggle on mobile */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-100 transition-colors xl:cursor-default"
        onClick={() => setStage2Open(prev => !prev)}
      >
        <div>
          <p className="text-sm font-semibold text-slate-600 text-left">{t.fullSystem.refineTitle}</p>
          <p className="text-[11px] text-slate-400 text-left mt-0.5">{t.fullSystem.refineSubtitle}</p>
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 xl:hidden ${stage2Open ? 'rotate-180' : ''}`}
        />
      </button>

      {stage2Open && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-slate-200">

          {/* Breed */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {t.fullSystem.breedLabel}
            </label>
            <div className="relative">
              <input
                type="text"
                value={breedInput}
                onChange={e => { setBreedInput(e.target.value); setBreed(e.target.value); setShowBreedSug(true); }}
                onFocus={() => setShowBreedSug(true)}
                onBlur={() => setTimeout(() => setShowBreedSug(false), 150)}
                placeholder={t.fullSystem.breedPlaceholder}
                className="w-full px-2.5 py-1.5 text-[12px] border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300"
              />
              {showBreedSug && filteredBreeds.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
                  {filteredBreeds.slice(0, 5).map(b => (
                    <button
                      key={b}
                      onMouseDown={e => { e.preventDefault(); setBreedInput(b); setBreed(b); setShowBreedSug(false); }}
                      className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sex */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {t.fullSystem.sexLabel}
            </label>
            <div className="grid grid-cols-2 gap-1">
              {SEX_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSex(sex === opt.value ? 'Unknown' : opt.value)}
                  className={`px-2 py-1.5 text-[11px] rounded-md border transition-all ${
                    sex === opt.value
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Age */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {t.fullSystem.ageLabel}
            </label>
            <input
              type="number"
              value={ageYears}
              onChange={e => setAgeYears(e.target.value)}
              placeholder={t.fullSystem.agePlaceholder}
              min={0}
              max={30}
              step={1}
              className="w-full px-2.5 py-1.5 text-[12px] border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300"
            />
          </div>

          {/* Allergies */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              알레르기
            </label>
            <TagInput
              items={allergies}
              onAdd={a => setAllergies(prev => [...prev, a])}
              onRemove={a => setAllergies(prev => prev.filter(x => x !== a))}
              placeholder="예: Penicillin"
              chipClass="bg-amber-50 text-amber-700 border border-amber-100"
              suggestions={COMMON_ALLERGIES}
            />
          </div>

          {/* Conditions */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              기저 질환
            </label>
            <TagInput
              items={conditions}
              onAdd={c => setConditions(prev => [...prev, c])}
              onRemove={c => setConditions(prev => prev.filter(x => x !== c))}
              placeholder="예: CKD, Diabetes..."
              chipClass="bg-red-50 text-red-700 border border-red-100"
              suggestions={COMMON_CONDITIONS}
            />
          </div>

          {/* Creatinine */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              {t.fullSystem.creatinineLabel}
              <span className="normal-case font-normal text-slate-300">{t.fullSystem.creatinineUnit}</span>
            </label>
            <input
              type="number"
              value={creatinine}
              onChange={e => setCreatinine(e.target.value)}
              placeholder="예: 1.2"
              min={0}
              step={0.1}
              className="w-full px-2.5 py-1.5 text-[12px] border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300"
            />
            {showIrisHint && (
              <p className="text-[10px] text-amber-600 font-medium">{t.fullSystem.creatinineIrisHint}</p>
            )}
            {!showIrisHint && (
              <p className="text-[10px] text-slate-300">{t.fullSystem.creatinineIrisHint}</p>
            )}
          </div>

          {/* ALT */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              {t.fullSystem.altLabel}
              <span className="normal-case font-normal text-slate-300">{t.fullSystem.altUnit}</span>
            </label>
            <input
              type="number"
              value={alt}
              onChange={e => setAlt(e.target.value)}
              placeholder="예: 45"
              min={0}
              step={1}
              className="w-full px-2.5 py-1.5 text-[12px] border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300"
            />
            <p className="text-[10px] text-slate-300">{t.fullSystem.altHint}</p>
          </div>

          {/* Save button */}
          <button
            onClick={onSave}
            className="w-full px-4 py-2.5 bg-slate-700 text-white text-[12px] font-semibold rounded-lg hover:bg-slate-800 transition-colors"
          >
            {t.fullSystem.savePatient}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Password Gate ─────────────────────────────────────────────────────────────

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
      <header className="bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.07),0_3px_10px_rgba(15,23,42,0.04)]">
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
                onChange={e => setPassword(e.target.value)}
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
              <p className="text-xs text-red-500 animate-fade-in">{t.fullSystem.invalidPassword}</p>
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

// ── Full System Main ──────────────────────────────────────────────────────────

export default function FullSystem() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const [authenticated, setAuthenticated] = useState(false);

  // ── Stage 1 state ────────────────────────────────────────────
  const [species, setSpecies] = useState('dog');
  const [weight, setWeight] = useState(10);
  const [patientName, setPatientName] = useState('');

  // ── Stage 2 state ────────────────────────────────────────────
  const [breed, setBreed] = useState('');
  const [sex, setSex] = useState('Unknown');
  const [ageYears, setAgeYears] = useState('');
  const [conditions, setConditions] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [creatinine, setCreatinine] = useState('');
  const [alt, setAlt] = useState('');

  // ── Drug state ───────────────────────────────────────────────
  const [drugs, setDrugs] = useState([]);

  // ── Patient persistence ───────────────────────────────────────
  const [patientSearch, setPatientSearch] = useState('');
  const [savedPatients, setSavedPatients] = useState([]);
  const [lastRecordedInfo, setLastRecordedInfo] = useState(null);
  const [showPatientList, setShowPatientList] = useState(false);
  const [chronicMedChecks, setChronicMedChecks] = useState({});

  // ── UI state ─────────────────────────────────────────────────
  const [showEMRModal, setShowEMRModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [stage2Open, setStage2Open] = useState(true);

  // ── Flow state ───────────────────────────────────────────────
  const [step, setStep] = useState('input');
  const [results, setResults] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const pollRef = useRef(null);
  const debounceRef = useRef(null);

  // ── Backend polling ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const ok = await isBackendAvailable();
      if (!cancelled) setIsConnected(ok);
    };
    check();
    pollRef.current = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
  }, []);

  // ── Load saved patients on mount ─────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem('nuvovet_patients_v1');
      if (stored) {
        setSavedPatients(JSON.parse(stored));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // ── Auto-rerun on Stage 2 changes ────────────────────────────
  useEffect(() => {
    if (step !== 'results' || drugs.length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const newResults = runFullDURAnalysis(drugs, species, weight);
      newResults.wasRefined = true;
      setResults(newResults);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [breed, sex, ageYears, conditions, allergies, creatinine, alt]);

  // ── Drug callbacks ───────────────────────────────────────────
  const handleAddDrug = useCallback((drug) => setDrugs(prev => [...prev, drug]), []);
  const handleRemoveDrug = useCallback((drugId) => setDrugs(prev => prev.filter(d => d.id !== drugId)), []);
  const handleUpdateDrug = useCallback((drugId, patch) => setDrugs(prev => prev.map(d => d.id === drugId ? { ...d, ...patch } : d)), []);

  if (!authenticated) {
    return <PasswordGate onAuthenticate={() => setAuthenticated(true)} />;
  }

  // ── Handlers ─────────────────────────────────────────────────

  const handleRunAnalysis = () => {
    if (drugs.length < 1 || !species || !(weight > 0)) return;
    setStep('analyzing');
  };

  const handleAnalysisComplete = () => {
    const analysisResults = runFullDURAnalysis(drugs, species, weight);
    setResults(analysisResults);
    setStep('results');
  };

  const handleBackToInput = () => setStep('input');

  const handleNewAnalysis = () => {
    setDrugs([]);
    setResults(null);
    setStep('input');
  };

  const handleReset = () => {
    setDrugs([]);
    setResults(null);
    setStep('input');
    setSpecies('dog');
    setWeight(10);
    setPatientName('');
    setBreed('');
    setSex('Unknown');
    setAgeYears('');
    setConditions([]);
    setAllergies([]);
    setCreatinine('');
    setAlt('');
    setPatientSearch('');
    setLastRecordedInfo(null);
    setShowPatientList(false);
    setChronicMedChecks({});
    setSaveSuccess(false);
  };

  const handleSelectPatient = (p) => {
    setPatientName(p.name || '');
    setSpecies(p.species || 'dog');
    setWeight(p.weight || 10);
    setBreed(p.breed || '');
    setSex(p.sex || 'Unknown');
    setAgeYears(p.ageYears || '');
    setConditions(p.conditions || []);
    setAllergies(p.allergies || []);
    setCreatinine(p.creatinine || '');
    setAlt(p.alt || '');
    if (p.weight && p.savedDate) {
      setLastRecordedInfo({
        weight: p.weight,
        date: p.savedDate.split('T')[0],
        chronicMeds: p.chronicMeds || [],
      });
      // init chronic med checkboxes (all checked by default)
      const checks = {};
      (p.chronicMeds || []).forEach(m => { checks[m.id] = true; });
      setChronicMedChecks(checks);
    }
    setPatientSearch(p.name || '');
    setShowPatientList(false);
  };

  const handleSavePatient = () => {
    const record = {
      name: patientName,
      species,
      weight,
      breed,
      sex,
      ageYears,
      conditions,
      allergies,
      creatinine,
      alt,
      chronicMeds: drugs.map(d => ({ id: d.id, name: d.name })),
      savedDate: new Date().toISOString(),
    };
    const existing = savedPatients.filter(p => p.name !== patientName);
    const updated = [record, ...existing];
    setSavedPatients(updated);
    try {
      localStorage.setItem('nuvovet_patients_v1', JSON.stringify(updated));
    } catch {
      // quota exceeded or unavailable
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // ── Derived ───────────────────────────────────────────────────

  const filteredPatients = savedPatients.filter(p => {
    if (!patientSearch.trim()) return false;
    const q = patientSearch.toLowerCase();
    return (p.name || '').toLowerCase().includes(q);
  });

  const canRun = species && weight > 0 && drugs.length > 0;

  const creatVal = parseFloat(creatinine);
  const patientInfo = {
    name: patientName,
    species,
    breed,
    weight,
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

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-slate-50/30 overflow-hidden">

      {/* ── Sticky Header ───────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.07),0_3px_10px_rgba(15,23,42,0.04)] shrink-0">
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
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse-subtle" />
                {t.connected}
              </span>
            ) : (
              <span className="text-[11px] px-2.5 py-1 bg-red-50 text-red-600 rounded-full font-semibold flex items-center gap-1.5 border border-red-100">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                Offline
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Save success toast ───────────────────────────────────── */}
      {saveSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-slate-800 text-white text-sm font-medium rounded-xl shadow-lg animate-fade-in">
          {t.fullSystem.patientSaved}
        </div>
      )}

      {/* ── EMR Modal ───────────────────────────────────────────── */}
      {showEMRModal && (
        <EMRImportModal onClose={() => setShowEMRModal(false)} t={t} />
      )}

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* ── ANALYZING STEP ──────────────────────────────────────── */}
        {step === 'analyzing' && (
          <AnalysisScreen
            onComplete={handleAnalysisComplete}
            drugCount={drugs.length}
            species={species}
          />
        )}

        {/* ── INPUT STEP ──────────────────────────────────────────── */}
        {step === 'input' && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-xl mx-auto px-4 py-8 space-y-6">

              {/* 1. Patient search bar */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {t.fullSystem.searchPatient}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={e => {
                      setPatientSearch(e.target.value);
                      setPatientName(e.target.value);
                      setShowPatientList(true);
                    }}
                    onFocus={() => setShowPatientList(true)}
                    onBlur={() => setTimeout(() => setShowPatientList(false), 200)}
                    placeholder={t.fullSystem.searchPatientPlaceholder}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 bg-white placeholder:text-slate-300 transition-all"
                  />
                  {showPatientList && patientSearch.trim() && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                      {filteredPatients.length === 0 ? (
                        <div className="px-4 py-3 text-[12px] text-slate-400">{t.fullSystem.noSavedPatients}</div>
                      ) : (
                        filteredPatients.slice(0, 6).map((p, i) => (
                          <button
                            key={i}
                            onMouseDown={e => { e.preventDefault(); handleSelectPatient(p); }}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                          >
                            <div className="text-sm font-medium text-slate-800">{p.name}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {p.species === 'dog' ? '개' : '고양이'}
                              {p.weight ? ` · ${p.weight} kg` : ''}
                              {p.savedDate ? ` · ${p.savedDate.split('T')[0]}` : ''}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Species toggle */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {t.fullSystem.speciesToggleLabel}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSpecies('dog')}
                    className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 font-semibold text-sm transition-all ${
                      species === 'dog'
                        ? 'border-slate-800 bg-slate-800 text-white shadow-md'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-2xl">🐕</span>
                    <span>개 / Canine</span>
                  </button>
                  <button
                    onClick={() => setSpecies('cat')}
                    className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border-2 font-semibold text-sm transition-all ${
                      species === 'cat'
                        ? 'border-slate-800 bg-slate-800 text-white shadow-md'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-2xl">🐈</span>
                    <span>고양이 / Feline</span>
                  </button>
                </div>
              </div>

              {/* 3. Weight */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {t.fullSystem.weightLabel}
                </label>
                {lastRecordedInfo && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-700">
                    <span>
                      {t.fullSystem.lastRecordedWeight}: <strong>{lastRecordedInfo.weight} kg</strong>
                      {' '}({t.fullSystem.lastRecordedDate}: {lastRecordedInfo.date})
                      {' '}— {t.fullSystem.confirmOrUpdateWeight}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={weight}
                    onChange={e => setWeight(parseFloat(e.target.value) || 0)}
                    min={0.1}
                    max={200}
                    step={0.1}
                    placeholder={t.fullSystem.weightPlaceholder}
                    className="flex-1 px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300"
                  />
                  <span className="text-sm text-slate-400 font-medium shrink-0">kg</span>
                </div>
              </div>

              {/* 4. EMR import button */}
              <div>
                <button
                  onClick={() => setShowEMRModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all bg-white"
                >
                  <Camera size={14} className="text-slate-400" />
                  {t.fullSystem.importFromEMR}
                </button>
              </div>

              {/* 5. Drug input */}
              <div>
                <DrugInput
                  drugs={drugs}
                  onAddDrug={handleAddDrug}
                  onRemoveDrug={handleRemoveDrug}
                  onUpdateDrug={handleUpdateDrug}
                  species={species}
                  weight={weight}
                  searchFn={searchDrugsApi}
                />
              </div>

              {/* 6. Chronic meds section */}
              {lastRecordedInfo && lastRecordedInfo.chronicMeds && lastRecordedInfo.chronicMeds.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{t.fullSystem.chronicMedsTitle}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{t.fullSystem.chronicMedsDesc}</p>
                  </div>
                  <div className="space-y-2">
                    {lastRecordedInfo.chronicMeds.map(med => (
                      <label key={med.id} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={!!chronicMedChecks[med.id]}
                          onChange={e => setChronicMedChecks(prev => ({ ...prev, [med.id]: e.target.checked }))}
                          className="w-4 h-4 rounded border-slate-300 text-slate-800 focus:ring-slate-500"
                        />
                        <span className="text-[12px] text-slate-700 group-hover:text-slate-900">{med.name}</span>
                        <span className="text-[11px] text-slate-400">{t.fullSystem.stillOnMed}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 7. Run DUR Check button */}
              <div className="space-y-2">
                <button
                  onClick={handleRunAnalysis}
                  disabled={!canRun}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
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
                  <p className="text-center text-[11px] text-slate-400">{t.fullSystem.runDurDisabledHint}</p>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ── RESULTS STEP ────────────────────────────────────────── */}
        {step === 'results' && (
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col xl:flex-row gap-0 xl:gap-5 min-h-full">
              {/* Results */}
              <div className="flex-1 min-w-0">
                <ResultsDisplay
                  results={results}
                  onBack={handleBackToInput}
                  onNewAnalysis={handleNewAnalysis}
                  isFullSystem
                  drugs={drugs}
                  species={species}
                  patientInfo={patientInfo}
                />
              </div>
              {/* Stage 2 refinement panel */}
              <div className="xl:w-80 2xl:w-96 xl:shrink-0 p-4 xl:py-6 xl:pr-5 xl:pl-0">
                {results && results.wasRefined && (
                  <div className="mb-3 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full w-fit">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                    <span className="text-[10px] font-semibold text-indigo-600">{t.fullSystem.refinedBadge}</span>
                  </div>
                )}
                <RefinementPanel
                  t={t}
                  lang={lang}
                  breed={breed}
                  setBreed={setBreed}
                  sex={sex}
                  setSex={setSex}
                  ageYears={ageYears}
                  setAgeYears={setAgeYears}
                  conditions={conditions}
                  setConditions={setConditions}
                  allergies={allergies}
                  setAllergies={setAllergies}
                  creatinine={creatinine}
                  setCreatinine={setCreatinine}
                  alt={alt}
                  setAlt={setAlt}
                  species={species}
                  onSave={handleSavePatient}
                  stage2Open={stage2Open}
                  setStage2Open={setStage2Open}
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
