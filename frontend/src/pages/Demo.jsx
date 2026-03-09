import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Zap, ChevronRight, ChevronDown, ChevronUp,
  Heart, Thermometer, Weight, Calendar, AlertCircle,
  Plus, X, Search, Pencil, FileText, Activity
} from 'lucide-react';
import { NuvovetLogo, NuvovetWordmark } from '../components/NuvovetLogo';
import { DrugInput } from '../components/DrugInput';
import { AnalysisScreen } from '../components/AnalysisScreen';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { getDrugById } from '../data/drugDatabase';
import { getBreedsForSpecies, getBreedProfile } from '../data/breedProfiles';
import { runFullDURAnalysis } from '../utils/durEngine';
import { getBreedImage } from '../assets/breeds/index';
import { useI18n, LangToggle } from '../i18n';

// ── Common veterinary conditions for autocomplete ───────────────
const COMMON_CONDITIONS = [
  'Hip Dysplasia', 'Elbow Dysplasia', 'Osteoarthritis', 'Chronic Pain',
  'Seasonal Allergies', 'Atopic Dermatitis', 'Food Allergy',
  'Diabetes mellitus', 'Hypothyroidism', 'Hyperthyroidism', 'Cushing\'s Disease',
  'CKD (Chronic Kidney Disease)', 'Early Stage Renal Failure', 'Hepatic Disease',
  'Congestive Heart Failure', 'Hypertrophic Cardiomyopathy (HCM)', 'Dilated Cardiomyopathy',
  'Epilepsy', 'Seizure Disorder', 'IVDD — Intervertebral Disc Disease',
  'Pancreatitis', 'Inflammatory Bowel Disease', 'Urinary Tract Infection',
  'Feline Lower Urinary Tract Disease', 'Anxiety', 'Separation Anxiety',
  'Brachycephalic Syndrome', 'MDR1 Deficient', 'Immune-Mediated Hemolytic Anemia',
  'Lymphoma', 'Mast Cell Tumor', 'Heartworm Disease',
];

// ── Step indicator ──────────────────────────────────────────────
function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-3">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className={`h-1.5 rounded-full transition-all duration-500 ${
            i < current ? 'w-6 bg-slate-900' :
            i === current ? 'w-8 bg-slate-900' :
            'w-4 bg-slate-200'
          }`} />
        </div>
      ))}
    </div>
  );
}

// ── Breed image helper ──────────────────────────────────────────
function BreedPhoto({ breedId, species, size = 44, className = '' }) {
  const src = getBreedImage(breedId);
  if (src) {
    return (
      <img
        src={src}
        alt={breedId}
        className={`rounded-full object-cover border-2 border-slate-200 bg-slate-50 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-xl shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {species === 'dog' ? '🐕' : '🐈'}
    </div>
  );
}

// ── Step 1: Species Selection ───────────────────────────────────
function SpeciesStep({ onSelect }) {
  const [hovered, setHovered] = useState(null);
  const { t } = useI18n();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 sm:py-16 animate-slide-in">
      <p className="typo-section-header mb-2">{t.demo.step1}</p>
      <h2 className="typo-page-title text-center mb-2">{t.demo.selectSpecies}</h2>
      <p className="typo-body text-center mb-10 max-w-sm">
        {t.demo.selectSpeciesDesc}
      </p>

      <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
        {[
          { id: 'dog', label: t.demo.canine, sub: t.demo.canineSub, img: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop&q=80' },
          { id: 'cat', label: t.demo.feline, sub: t.demo.felineSub, img: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=300&fit=crop&q=80' },
        ].map((sp) => (
          <button
            key={sp.id}
            onClick={() => onSelect(sp.id)}
            onMouseEnter={() => setHovered(sp.id)}
            onMouseLeave={() => setHovered(null)}
            className={`relative flex flex-col items-center gap-3 p-4 sm:p-6 rounded-xl border-2 transition-all duration-300 overflow-hidden ${
              hovered === sp.id
                ? 'border-slate-900 bg-slate-50 shadow-md scale-[1.02]'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 mb-1">
              <img
                src={sp.img}
                alt={sp.label}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div>
              <p className="typo-drug-name">{sp.label}</p>
              <p className="typo-label mt-0.5">{sp.sub}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: Breed Selection ─────────────────────────────────────
function BreedStep({ species, onSelect, onBack }) {
  const breeds = getBreedsForSpecies(species);
  const { t } = useI18n();

  return (
    <div className="flex-1 flex flex-col px-5 py-8 animate-slide-in">
      <div className="max-w-lg mx-auto w-full">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-6 transition-colors">
          <ArrowLeft size={14} /> {t.back}
        </button>

        <p className="typo-section-header mb-2">{t.demo.step2}</p>
        <h2 className="typo-page-title mb-1.5">{t.demo.selectBreed}</h2>
        <p className="typo-body mb-8">
          {t.demo.selectBreedDesc}
        </p>

        <div className="space-y-3">
          {breeds.map((breed) => (
            <button
              key={breed.id}
              onClick={() => onSelect(breed.id)}
              className="w-full flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all duration-200 text-left group"
            >
              <BreedPhoto breedId={breed.id} species={species} size={56} />
              <div className="flex-1 min-w-0">
                <p className="typo-drug-name">{breed.breed}</p>
                <p className="typo-label mt-0.5 truncate">
                  {breed.profile.name} · {breed.profile.age} · {breed.profile.conditions.join(', ')}
                </p>
                {breed.demonstrates && (
                  <p className="text-[10px] text-slate-400 mt-1 italic">
                    {t.demo.demonstrates}: {breed.demonstrates}
                  </p>
                )}
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Patient EMR Profile (Collapsed Summary) ─────────────
function PatientProfileStep({ profile, breed, breedId, species, onUpdateProfile, onContinue, onBack }) {
  const { t, lang } = useI18n();
  const p = profile;
  const [expanded, setExpanded] = useState(false);

  // Editable fields
  const [editingWeight, setEditingWeight] = useState(false);
  const [tempWeight, setTempWeight] = useState(p.weight);
  const [newAllergy, setNewAllergy] = useState('');
  const [newCondition, setNewCondition] = useState('');
  const [showAddAllergy, setShowAddAllergy] = useState(false);
  const [showAddCondition, setShowAddCondition] = useState(false);
  const [conditionSuggestions, setConditionSuggestions] = useState([]);

  const statusColor = (s) => {
    if (s === 'high') return 'text-red-600 bg-red-50';
    if (s === 'low') return 'text-amber-600 bg-amber-50';
    return 'text-slate-600 bg-slate-50';
  };

  // Get abnormal labs automatically
  const abnormalLabs = Object.entries(p.labResults)
    .filter(([, lab]) => lab.status !== 'normal')
    .map(([key, lab]) => ({ key, ...lab }));

  // Condition autocomplete
  const handleConditionInput = (value) => {
    setNewCondition(value);
    if (value.trim().length >= 2) {
      const matches = COMMON_CONDITIONS.filter(c =>
        c.toLowerCase().includes(value.toLowerCase()) &&
        !p.conditions.includes(c)
      ).slice(0, 5);
      setConditionSuggestions(matches);
    } else {
      setConditionSuggestions([]);
    }
  };

  const addCondition = (cond) => {
    onUpdateProfile({ ...p, conditions: [...p.conditions, cond] });
    setNewCondition('');
    setConditionSuggestions([]);
    setShowAddCondition(false);
  };

  return (
    <div className="flex-1 flex flex-col px-5 py-6 animate-slide-in">
      <div className="max-w-lg mx-auto w-full space-y-5">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft size={14} /> {t.back}
        </button>

        <div>
          <p className="typo-section-header mb-2">{t.demo.step3}</p>
          <h2 className="typo-page-title mb-1">{t.demo.patientChart}</h2>
          <p className="typo-body">{t.demo.patientChartDesc}</p>
        </div>

        {/* ── Summary Card (always visible) ── */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BreedPhoto breedId={breedId} species={species} size={80} className="border-slate-200" />
              <div>
                <h3 className="typo-drug-name text-[15px]">{p.name}</h3>
                <p className="typo-label">{breed} · {species === 'dog' ? t.species.dog : t.species.cat} · {p.sex}</p>
              </div>
            </div>
            <span className="typo-label px-2 py-1 bg-slate-200/60 text-slate-500 rounded-full">
              {t.demoPatient}
            </span>
          </div>

          {/* Key facts row */}
          <div className="px-4 py-3 grid grid-cols-3 gap-3">
            <div>
              <p className="typo-label uppercase">{t.demo.age}</p>
              <p className="typo-drug-name text-[14px]">{p.age}</p>
            </div>
            <div>
              <p className="typo-label uppercase">{t.demo.weight}</p>
              {editingWeight ? (
                <input
                  type="number"
                  value={tempWeight}
                  onChange={(e) => setTempWeight(parseFloat(e.target.value) || 0)}
                  onBlur={() => { onUpdateProfile({ ...p, weight: tempWeight }); setEditingWeight(false); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { onUpdateProfile({ ...p, weight: tempWeight }); setEditingWeight(false); } }}
                  className="w-16 text-sm font-semibold text-slate-900 border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => setEditingWeight(true)}
                  className="typo-drug-name text-[14px] hover:text-slate-600 inline-flex items-center gap-1 group"
                >
                  {p.weight} kg
                  <Pencil size={9} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                </button>
              )}
            </div>
            <div>
              <p className="typo-label uppercase">{t.demo.bcs}</p>
              <p className="typo-drug-name text-[14px]">{p.bodyCondition}</p>
            </div>
          </div>

          <div className="px-4 pb-3 flex flex-wrap gap-2">
            <span className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-full px-2 py-0.5">
              Chart #{p.animalChartId}
            </span>
            <span className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-full px-2 py-0.5">
              Status: {p.patientStatus}
            </span>
            {p.lastVisitDate && (
              <span className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-full px-2 py-0.5">
                Last visit: {p.lastVisitDate}
              </span>
            )}
          </div>

          {/* Active conditions */}
          <div className="px-4 pb-3">
            <p className="typo-label uppercase mb-1.5">{t.demo.activeConditions}</p>
            <div className="flex flex-wrap gap-1.5">
              {p.conditions.map((cond, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-100">
                  {cond}
                  <button
                    onClick={() => onUpdateProfile({ ...p, conditions: p.conditions.filter((_, j) => j !== i) })}
                    className="text-amber-400 hover:text-amber-600"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <button
                onClick={() => setShowAddCondition(true)}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs text-slate-400 hover:text-slate-600 border border-dashed border-slate-200 rounded-full"
              >
                <Plus size={10} /> {t.add}
              </button>
            </div>
            {showAddCondition && (
              <div className="relative mt-2 animate-fade-in">
                <input
                  type="text"
                  value={newCondition}
                  onChange={(e) => handleConditionInput(e.target.value)}
                  placeholder={t.demo.typeToSearch}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCondition.trim()) {
                      addCondition(newCondition.trim());
                    }
                    if (e.key === 'Escape') {
                      setShowAddCondition(false);
                      setNewCondition('');
                      setConditionSuggestions([]);
                    }
                  }}
                />
                {conditionSuggestions.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {conditionSuggestions.map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => addCondition(sug)}
                        className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Abnormal labs auto-surfaced */}
          {abnormalLabs.length > 0 && (
            <div className="px-4 pb-3">
              <p className="typo-label uppercase mb-1.5">{t.demo.flaggedLabs}</p>
              <div className="flex flex-wrap gap-2">
                {abnormalLabs.map((lab, i) => (
                  <span
                    key={i}
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      lab.status === 'high' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                    }`}
                  >
                    {lab.key.toUpperCase()}: {lab.value} {lab.unit} {lab.status === 'high' ? '↑' : '↓'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Edit Details Expand ── */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors py-1"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? t.demo.hideDetails : t.demo.editDetails}
        </button>

        {expanded && (
          <div className="space-y-5 animate-fade-in">
            {/* Vitals grid */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <span className="typo-section-header">{t.demo.vitals}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
                {[
                  { icon: Calendar, label: t.demo.age, value: p.age },
                  { icon: Weight, label: t.demo.weight, value: `${p.weight} kg` },
                  { icon: Heart, label: t.demo.heartRate, value: p.heartRate },
                  { icon: Thermometer, label: t.demo.temp, value: p.temperature },
                ].map((v, i) => (
                  <div key={i} className="px-3 py-3 text-center">
                    <v.icon size={13} className="text-slate-400 mx-auto mb-1" />
                    <p className="typo-label mb-0.5">{v.label}</p>
                    <p className="typo-drug-name text-[14px]">{v.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Body Condition */}
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between shadow-sm">
              <div>
                <p className="typo-label mb-0.5">{t.demo.bodyCondition}</p>
                <p className="typo-drug-name text-[14px]">{p.bodyCondition}</p>
              </div>
              <div>
                <p className="typo-label mb-0.5">{t.demo.respRate}</p>
                <p className="typo-drug-name text-[14px]">{p.respRate}</p>
              </div>
            </div>

            {/* Allergies */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="typo-section-header">{t.demo.knownAllergies}</span>
                <button
                  onClick={() => setShowAddAllergy(true)}
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
                >
                  <Plus size={12} /> {t.add}
                </button>
              </div>
              <div className="px-4 py-3">
                {p.allergies.length === 0 ? (
                  <p className="typo-body italic">{t.demo.nkda}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {p.allergies.map((allergy, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full border border-red-100">
                        {allergy}
                        <button
                          onClick={() => onUpdateProfile({ ...p, allergies: p.allergies.filter((_, j) => j !== i) })}
                          className="text-red-400 hover:text-red-600"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {showAddAllergy && (
                  <div className="flex gap-2 mt-2 animate-fade-in">
                    <input
                      type="text"
                      value={newAllergy}
                      onChange={(e) => setNewAllergy(e.target.value)}
                      placeholder="e.g., Penicillin"
                      className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newAllergy.trim()) {
                          onUpdateProfile({ ...p, allergies: [...p.allergies, newAllergy.trim()] });
                          setNewAllergy('');
                          setShowAddAllergy(false);
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (newAllergy.trim()) {
                          onUpdateProfile({ ...p, allergies: [...p.allergies, newAllergy.trim()] });
                          setNewAllergy('');
                        }
                        setShowAddAllergy(false);
                      }}
                      className="px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded-lg hover:bg-slate-800"
                    >
                      {t.add}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Lab Results */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <span className="typo-section-header">{t.demo.allLabResults}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-slate-100">
                {Object.entries(p.labResults).map(([key, lab]) => (
                  <div key={key} className="px-3 py-2.5">
                    <p className="typo-label uppercase mb-0.5">{key}</p>
                    <p className={`text-sm font-semibold ${lab.status === 'high' ? 'text-red-600' : lab.status === 'low' ? 'text-amber-600' : 'text-slate-900'}`}>
                      {lab.value}
                      <span className="text-xs font-normal text-slate-400 ml-1">{lab.unit}</span>
                    </p>
                    {lab.status !== 'normal' && (
                      <span className={`text-xs font-medium ${lab.status === 'high' ? 'text-red-500' : 'text-amber-500'}`}>
                        {lab.status === 'high' ? '↑ High' : '↓ Low'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Clinical History */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <span className="typo-section-header">{t.demo.clinicalHistory}</span>
              </div>
              <div className="px-4 py-3">
                <p className="typo-body leading-relaxed">{p.history}</p>
              </div>
            </div>

            {/* EMR Registration Fields */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <span className="typo-section-header">EMR Registration</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                <div className="px-4 py-3 space-y-1">
                  <p className="typo-label">DOB</p>
                  <p className="typo-drug-name text-[13px]">{p.dateOfBirth || '-'}</p>
                  <p className="typo-label mt-2">Registration No.</p>
                  <p className="typo-drug-name text-[13px]">{p.animalRegistrationNumber || '-'}</p>
                  <p className="typo-label mt-2">Blood Type</p>
                  <p className="typo-drug-name text-[13px]">{p.bloodType || '-'}</p>
                </div>
                <div className="px-4 py-3 space-y-1">
                  <p className="typo-label">Attending Vet</p>
                  <p className="typo-drug-name text-[13px]">{p.attendingVet || '-'}</p>
                  <p className="typo-label mt-2">Primary Vet</p>
                  <p className="typo-drug-name text-[13px]">{p.primaryVet || '-'}</p>
                  <p className="typo-label mt-2">Insurance</p>
                  <p className="typo-drug-name text-[13px]">{p.insuranceGroup || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Continue button */}
        <button
          onClick={onContinue}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all duration-200 shadow-sm"
        >
          {t.demo.continueToMeds}
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Medication Review ───────────────────────────────────
function MedicationStep({ drugs, species, patientName, weight, onAddDrug, onRemoveDrug, onUpdateDrug, onRunAnalysis, onBack }) {
  const { t } = useI18n();
  return (
    <div className="flex-1 flex flex-col px-5 py-6 animate-slide-in">
      <div className="max-w-lg mx-auto w-full space-y-5">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft size={14} /> {t.demo.backToChart}
        </button>

        <div>
          <p className="typo-section-header mb-2">{t.demo.step4}</p>
          <h2 className="typo-page-title mb-1">{t.demo.prescriptions}</h2>
          <p className="typo-body">
            {t.demo.prescriptionsDesc} <span className="font-medium text-slate-700">{patientName}</span>
          </p>
        </div>

        {/* Drug input */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="typo-section-header mb-3">
            {t.demo.currentMeds} ({drugs.length})
          </h3>
          <DrugInput
            drugs={drugs}
            onAddDrug={onAddDrug}
            onRemoveDrug={onRemoveDrug}
            onUpdateDrug={onUpdateDrug}
            species={species}
            weight={weight || 10}
            demoMode
          />
        </div>

        {/* Run button */}
        <button
          onClick={onRunAnalysis}
          disabled={drugs.length === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
        >
          <Zap size={15} />
          {t.fullSystem.runScan}
        </button>
      </div>
    </div>
  );
}

// ── Main Demo Page ──────────────────────────────────────────────
const STEPS = ['species', 'breed', 'profile', 'medications', 'analyzing', 'results'];

export default function Demo() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [step, setStep] = useState('species');
  const [species, setSpecies] = useState(null);
  const [breedId, setBreedId] = useState(null);
  const [breedName, setBreedName] = useState('');
  const [profile, setProfile] = useState(null);
  const [drugs, setDrugs] = useState([]);
  const [results, setResults] = useState(null);

  const currentStepIndex = STEPS.indexOf(step);

  const handleSpeciesSelect = (sp) => {
    setSpecies(sp);
    setStep('breed');
  };

  const handleBreedSelect = (id) => {
    setBreedId(id);
    const breed = getBreedProfile(species, id);
    if (breed) {
      setProfile({ ...breed.profile });
      setBreedName(breed.breed);
      // Load default drugs
      const defaultDrugs = breed.profile.defaultDrugs
        .map(drugId => getDrugById(drugId))
        .filter(Boolean);
      setDrugs(defaultDrugs);
    }
    setStep('profile');
  };

  const handleUpdateProfile = (updated) => {
    setProfile(updated);
  };

  const handleAddDrug = (drug) => {
    setDrugs(prev => [...prev, drug]);
  };

  const handleRemoveDrug = (drugId) => {
    setDrugs(prev => prev.filter(d => d.id !== drugId));
  };

  const handleUpdateDrug = (drugId, patch) => {
    setDrugs(prev => prev.map((d) => (d.id === drugId ? { ...d, ...patch } : d)));
  };

  const handleRunAnalysis = () => {
    if (drugs.length < 1) return;
    setStep('analyzing');
  };

  const handleAnalysisComplete = useCallback(() => {
    const analysisResults = runFullDURAnalysis(drugs, species, profile?.weight || 10);
    setResults(analysisResults);
    setStep('results');
  }, [drugs, species, profile]);

  const handleBackToMeds = () => {
    setStep('medications');
  };

  const handleNewAnalysis = () => {
    setStep('species');
    setSpecies(null);
    setBreedId(null);
    setBreedName('');
    setProfile(null);
    setDrugs([]);
    setResults(null);
  };

  // Build enriched patient info for results
  const abnormalLabs = profile ? Object.entries(profile.labResults || {})
    .filter(([, lab]) => lab.status !== 'normal')
    .map(([key, lab]) => ({ key, ...lab })) : [];

  const patientInfo = profile ? {
    name: profile.name,
    species,
    breed: breedName,
    weight: profile.weight,
    conditions: profile.conditions,
    flaggedLabs: abnormalLabs,
  } : { name: profile?.name, species };

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col relative">
      {/* Dot grid background */}
      <div className="fixed inset-0 bg-dot-grid pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.07),0_3px_10px_rgba(15,23,42,0.04)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[62px] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (step === 'species') navigate('/');
              else if (step === 'breed') setStep('species');
              else if (step === 'profile') setStep('breed');
              else if (step === 'medications') setStep('profile');
              else if (step === 'results') setStep('medications');
              else navigate('/');
            }}
            className="p-2 -ml-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <NuvovetWordmark />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LangToggle />
          <span className="typo-label px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full">
            {t.demoLabel}
          </span>
        </div>
        </div>
      </header>

      {/* Step indicator */}
      {step !== 'analyzing' && step !== 'results' && (
        <StepIndicator current={currentStepIndex} steps={STEPS.slice(0, 4)} />
      )}

      {/* Content */}
      {step === 'species' && (
        <SpeciesStep onSelect={handleSpeciesSelect} />
      )}

      {step === 'breed' && (
        <BreedStep
          species={species}
          onSelect={handleBreedSelect}
          onBack={() => setStep('species')}
        />
      )}

      {step === 'profile' && profile && (
        <PatientProfileStep
          profile={profile}
          breed={breedName}
          breedId={breedId}
          species={species}
          onUpdateProfile={handleUpdateProfile}
          onContinue={() => setStep('medications')}
          onBack={() => setStep('breed')}
        />
      )}

      {step === 'medications' && (
        <MedicationStep
          drugs={drugs}
          species={species}
          patientName={profile?.name}
          weight={profile?.weight}
          onAddDrug={handleAddDrug}
          onRemoveDrug={handleRemoveDrug}
          onUpdateDrug={handleUpdateDrug}
          onRunAnalysis={handleRunAnalysis}
          onBack={() => setStep('profile')}
        />
      )}

      {step === 'analyzing' && (
        <AnalysisScreen
          onComplete={handleAnalysisComplete}
          drugCount={drugs.length}
          species={species}
        />
      )}

      {step === 'results' && (
        <main className="flex-1 pb-8">
          <ResultsDisplay
            results={results}
            onBack={handleBackToMeds}
            onNewAnalysis={handleNewAnalysis}
            patientInfo={patientInfo}
            drugs={drugs}
            species={species}
          />
        </main>
      )}
    </div>
  );
}
