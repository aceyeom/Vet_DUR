import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, ArrowLeft, ArrowRight, Zap, ChevronRight,
  Heart, Thermometer, Weight, Calendar, AlertCircle,
  Plus, X, Search, Pencil, FileText, Activity
} from 'lucide-react';
import { DrugInput } from '../components/DrugInput';
import { AnalysisScreen } from '../components/AnalysisScreen';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { getDrugById } from '../data/drugDatabase';
import { getBreedsForSpecies, getBreedProfile } from '../data/breedProfiles';
import { runFullDURAnalysis } from '../utils/durEngine';

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

// ── Step 1: Species Selection ───────────────────────────────────
function SpeciesStep({ onSelect }) {
  const [hovered, setHovered] = useState(null);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 sm:py-16 animate-slide-in">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Step 1</p>
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 text-center mb-2">Select Species</h2>
      <p className="text-sm text-slate-500 text-center mb-10 max-w-sm">
        Choose the patient species to load a sample clinical case.
      </p>

      <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
        {[
          { id: 'dog', label: 'Canine', sub: '4 sample breeds' },
          { id: 'cat', label: 'Feline', sub: '3 sample breeds' },
        ].map((sp) => (
          <button
            key={sp.id}
            onClick={() => onSelect(sp.id)}
            onMouseEnter={() => setHovered(sp.id)}
            onMouseLeave={() => setHovered(null)}
            className={`relative flex flex-col items-center gap-3 p-6 sm:p-8 rounded-xl border-2 transition-all duration-300 ${
              hovered === sp.id
                ? 'border-slate-900 bg-slate-50 shadow-md scale-[1.02]'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="text-4xl sm:text-5xl mb-1">
              {sp.id === 'dog' ? '🐕' : '🐈'}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{sp.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{sp.sub}</p>
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

  return (
    <div className="flex-1 flex flex-col px-5 py-8 animate-slide-in">
      <div className="max-w-lg mx-auto w-full">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-6 transition-colors">
          <ArrowLeft size={14} /> Back
        </button>

        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Step 2</p>
        <h2 className="text-xl font-bold text-slate-900 mb-1.5">Select Breed</h2>
        <p className="text-sm text-slate-500 mb-8">
          Each breed comes with a realistic patient profile and clinical history.
        </p>

        <div className="space-y-3">
          {breeds.map((breed) => (
            <button
              key={breed.id}
              onClick={() => onSelect(breed.id)}
              className="w-full flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all duration-200 text-left group"
            >
              <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xl shrink-0">
                {species === 'dog' ? '🐕' : '🐈'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{breed.breed}</p>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {breed.profile.name} · {breed.profile.age} · {breed.profile.conditions.join(', ')}
                </p>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Patient EMR Profile ─────────────────────────────────
function PatientProfileStep({ profile, species, onUpdateProfile, onContinue, onBack }) {
  const p = profile;

  // Editable fields
  const [editingWeight, setEditingWeight] = useState(false);
  const [tempWeight, setTempWeight] = useState(p.weight);
  const [newAllergy, setNewAllergy] = useState('');
  const [newCondition, setNewCondition] = useState('');
  const [showAddAllergy, setShowAddAllergy] = useState(false);
  const [showAddCondition, setShowAddCondition] = useState(false);

  const statusColor = (s) => {
    if (s === 'high') return 'text-red-600 bg-red-50';
    if (s === 'low') return 'text-amber-600 bg-amber-50';
    return 'text-slate-600 bg-slate-50';
  };

  return (
    <div className="flex-1 flex flex-col px-5 py-6 animate-slide-in">
      <div className="max-w-lg mx-auto w-full space-y-5">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft size={14} /> Back
        </button>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Step 3</p>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Patient Chart</h2>
          <p className="text-sm text-slate-500">Review and modify the patient profile before prescribing.</p>
        </div>

        {/* Patient header card */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-lg">
                {species === 'dog' ? '🐕' : '🐈'}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{p.name}</h3>
                <p className="text-xs text-slate-400">{species === 'dog' ? 'Canine' : 'Feline'} · {p.sex}</p>
              </div>
            </div>
            <span className="text-xs px-2 py-1 bg-slate-200/60 text-slate-500 rounded-full font-medium">
              Demo Patient
            </span>
          </div>

          {/* Vitals grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
            {[
              { icon: Calendar, label: 'Age', value: p.age },
              {
                icon: Weight, label: 'Weight',
                value: editingWeight ? null : `${p.weight} kg`,
                editable: true,
              },
              { icon: Heart, label: 'Heart Rate', value: p.heartRate },
              { icon: Thermometer, label: 'Temp', value: p.temperature },
            ].map((v, i) => (
              <div key={i} className="px-3 py-3 text-center">
                <v.icon size={13} className="text-slate-400 mx-auto mb-1" />
                <p className="text-xs text-slate-400 mb-0.5">{v.label}</p>
                {v.editable && editingWeight ? (
                  <input
                    type="number"
                    value={tempWeight}
                    onChange={(e) => setTempWeight(parseFloat(e.target.value) || 0)}
                    onBlur={() => {
                      onUpdateProfile({ ...p, weight: tempWeight });
                      setEditingWeight(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onUpdateProfile({ ...p, weight: tempWeight });
                        setEditingWeight(false);
                      }
                    }}
                    className="w-16 text-center text-sm font-semibold text-slate-900 border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={v.editable ? () => setEditingWeight(true) : undefined}
                    className={`text-sm font-semibold text-slate-900 ${v.editable ? 'hover:text-slate-600 cursor-pointer group inline-flex items-center gap-1' : ''}`}
                  >
                    {v.value}
                    {v.editable && <Pencil size={9} className="text-slate-300 group-hover:text-slate-500 transition-colors" />}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Body Condition */}
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Body Condition Score</p>
            <p className="text-sm font-semibold text-slate-900">{p.bodyCondition}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Resp Rate</p>
            <p className="text-sm font-semibold text-slate-900">{p.respRate}</p>
          </div>
        </div>

        {/* Conditions */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Conditions</span>
            <button
              onClick={() => setShowAddCondition(true)}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="px-4 py-3">
            {p.conditions.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No active conditions</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {p.conditions.map((cond, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-100">
                    {cond}
                    <button
                      onClick={() => onUpdateProfile({ ...p, conditions: p.conditions.filter((_, j) => j !== i) })}
                      className="text-amber-400 hover:text-amber-600"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {showAddCondition && (
              <div className="flex gap-2 mt-2 animate-fade-in">
                <input
                  type="text"
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value)}
                  placeholder="e.g., Diabetes mellitus"
                  className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCondition.trim()) {
                      onUpdateProfile({ ...p, conditions: [...p.conditions, newCondition.trim()] });
                      setNewCondition('');
                      setShowAddCondition(false);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (newCondition.trim()) {
                      onUpdateProfile({ ...p, conditions: [...p.conditions, newCondition.trim()] });
                      setNewCondition('');
                    }
                    setShowAddCondition(false);
                  }}
                  className="px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded-lg hover:bg-slate-800"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Allergies */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Known Allergies</span>
            <button
              onClick={() => setShowAddAllergy(true)}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
            >
              <Plus size={12} /> Add
            </button>
          </div>
          <div className="px-4 py-3">
            {p.allergies.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No known allergies (NKDA)</p>
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
                  Add
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Lab Results */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recent Lab Results</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-slate-100">
            {Object.entries(p.labResults).map(([key, lab]) => (
              <div key={key} className="px-3 py-2.5">
                <p className="text-xs text-slate-400 uppercase mb-0.5">{key}</p>
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
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Clinical History</span>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs text-slate-600 leading-relaxed">{p.history}</p>
          </div>
        </div>

        {/* Continue button */}
        <button
          onClick={onContinue}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all duration-200 shadow-sm"
        >
          Continue to Medications
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Medication Review ───────────────────────────────────
function MedicationStep({ drugs, species, patientName, onAddDrug, onRemoveDrug, onRunAnalysis, onBack }) {
  return (
    <div className="flex-1 flex flex-col px-5 py-6 animate-slide-in">
      <div className="max-w-lg mx-auto w-full space-y-5">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft size={14} /> Back to Chart
        </button>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Step 4</p>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Prescriptions</h2>
          <p className="text-sm text-slate-500">
            Review current medications for <span className="font-medium text-slate-700">{patientName}</span>. Add or remove drugs, then run the DUR scan.
          </p>
        </div>

        {/* Drug input */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Current Medications ({drugs.length})
          </h3>
          <DrugInput
            drugs={drugs}
            onAddDrug={onAddDrug}
            onRemoveDrug={onRemoveDrug}
            species={species}
            demoMode
          />
        </div>

        {/* Run button */}
        <button
          onClick={onRunAnalysis}
          disabled={drugs.length < 2}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
        >
          <Zap size={15} />
          Run DUR Scan
        </button>

        {drugs.length < 2 && (
          <p className="text-xs text-slate-400 text-center">
            Add at least 2 drugs to check interactions
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Demo Page ──────────────────────────────────────────────
const STEPS = ['species', 'breed', 'profile', 'medications', 'analyzing', 'results'];

export default function Demo() {
  const navigate = useNavigate();
  const [step, setStep] = useState('species');
  const [species, setSpecies] = useState(null);
  const [breedId, setBreedId] = useState(null);
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

  const handleRunAnalysis = () => {
    if (drugs.length < 2) return;
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
    setProfile(null);
    setDrugs([]);
    setResults(null);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      {/* Header */}
      <header className="bg-white px-4 sm:px-6 py-3 flex items-center justify-between border-b border-slate-200 sticky top-0 z-20">
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
            className="p-1.5 -ml-1.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
              <Shield size={13} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-900">VetDUR</span>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full font-medium">
          Demo
        </span>
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
          onAddDrug={handleAddDrug}
          onRemoveDrug={handleRemoveDrug}
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
          />
        </main>
      )}
    </div>
  );
}
