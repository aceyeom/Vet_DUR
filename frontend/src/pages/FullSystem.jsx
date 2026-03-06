import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Eye, EyeOff, Zap, RotateCcw } from 'lucide-react';
import { NuvovetLogo, NuvovetWordmark } from '../components/NuvovetLogo';
import { useI18n, LangToggle } from '../i18n';
import { PatientConfig } from '../components/PatientConfig';
import { DrugInput } from '../components/DrugInput';
import { AnalysisScreen } from '../components/AnalysisScreen';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { runFullDURAnalysis } from '../utils/durEngine';

const SYSTEM_PASSWORD = 'vetdur2025';

// ── Password Gate ───────────────────────────────────────────────
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
      <header className="px-6 py-4 flex items-center gap-3 border-b border-gray-100">
        <button
          onClick={() => navigate('/')}
          className="p-1.5 -ml-1.5 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <NuvovetLogo size={28} className="text-slate-900" />
          <NuvovetWordmark />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="max-w-sm w-full text-center">
          <div className="mx-auto w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
            <Lock size={24} className="text-slate-500" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">{t.fullSystem.accessTitle}</h2>
          <p className="text-sm text-slate-500 mb-8">
            {t.fullSystem.accessDesc}
          </p>

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

// ── Full System Main ────────────────────────────────────────────
export default function FullSystem() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [authenticated, setAuthenticated] = useState(false);
  const [species, setSpecies] = useState('dog');
  const [weight, setWeight] = useState(10);
  const [drugs, setDrugs] = useState([]);
  const [step, setStep] = useState('input'); // input | analyzing | results
  const [results, setResults] = useState(null);

  if (!authenticated) {
    return <PasswordGate onAuthenticate={() => setAuthenticated(true)} />;
  }

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

  const handleAnalysisComplete = () => {
    const analysisResults = runFullDURAnalysis(drugs, species, weight);
    setResults(analysisResults);
    setStep('results');
  };

  const handleBackToInput = () => {
    setStep('input');
  };

  const handleNewAnalysis = () => {
    setDrugs([]);
    setWeight(10);
    setResults(null);
    setStep('input');
  };

  const handleReset = () => {
    setDrugs([]);
    setSpecies('dog');
    setWeight(10);
    setResults(null);
    setStep('input');
  };

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col">
      {/* Header */}
      <header className="bg-white px-4 sm:px-6 py-3 flex items-center justify-between border-b border-slate-200 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 -ml-1.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <NuvovetLogo size={28} className="text-slate-900" />
            <div>
              <NuvovetWordmark />
              <span className="hidden sm:inline text-xs text-slate-400 ml-2">{t.fullSystemLabel}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LangToggle />
          {step === 'input' && drugs.length > 0 && (
            <button
              onClick={handleReset}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              title={t.reset}
            >
              <RotateCcw size={15} />
            </button>
          )}
          <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            {t.connected}
          </span>
        </div>
      </header>

      {/* Content */}
      {step === 'input' && (
        <main className="flex-1 max-w-lg mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
          {/* Patient config */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              {t.fullSystem.patientSection}
            </h3>
            <PatientConfig
              species={species}
              weight={weight}
              onSpeciesChange={setSpecies}
              onWeightChange={setWeight}
            />
          </div>

          {/* Drug input */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              {t.fullSystem.medsSection} {drugs.length > 0 && `(${drugs.length})`}
            </h3>
            <DrugInput
              drugs={drugs}
              onAddDrug={handleAddDrug}
              onRemoveDrug={handleRemoveDrug}
              species={species}
              weight={weight}
            />
          </div>

          {/* Run button */}
          <button
            onClick={handleRunAnalysis}
            disabled={drugs.length < 2}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
          >
            <Zap size={15} />
            {t.fullSystem.runScan}
          </button>

          {drugs.length < 2 && drugs.length > 0 && (
            <p className="text-xs text-slate-400 text-center">
              {t.fullSystem.addMoreDrugs}
            </p>
          )}
        </main>
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
            onBack={handleBackToInput}
            onNewAnalysis={handleNewAnalysis}
            isFullSystem={true}
            drugs={drugs}
            species={species}
            patientInfo={{ species, weight }}
          />
        </main>
      )}
    </div>
  );
}
