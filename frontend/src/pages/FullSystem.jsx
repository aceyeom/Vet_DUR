import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Lock, Eye, EyeOff, Zap, RotateCcw,
  ChevronDown, ChevronUp, Plus, X, Camera, Users, Save,
  CheckCircle, AlertCircle, LogOut, Search, UserPlus,
  Filter, SortAsc, ChevronRight,
} from 'lucide-react';
import { NuvovetWordmark } from '../components/NuvovetLogo';
import { useI18n, LangToggle } from '../i18n';
import { DrugInput } from '../components/DrugInput';
import { AnalysisScreen } from '../components/AnalysisScreen';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { runFullDURAnalysis } from '../utils/durEngine';
import { searchDrugsApi, isBackendAvailable, getBreedsApi, getConditionsApi, getAllergiesApi } from '../lib/api';
import { EMRImportModal } from '../components/EMRImportModal';
import { searchPatients, savePatient, addVisitRecord, getAllPatients, sortPatients } from '../lib/patientStorage';
import { useAuth } from '../context/AuthContext';
import { OrganLoadIndicator } from '../components/OrganLoadIndicator';

// ── Decimal number input ──────────────────────────────────────────
function DecimalInput({ value, onChange, onBlur, placeholder, className, min, max }) {
  const [localVal, setLocalVal] = useState(
    value !== 0 && value !== null && value !== undefined ? String(value) : ''
  );
  useEffect(() => {
    setLocalVal(value !== 0 && value !== null && value !== undefined ? String(value) : '');
  }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={localVal}
      onChange={(e) => { setLocalVal(e.target.value); onChange(e.target.value); }}
      onBlur={() => {
        const parsed = parseFloat(localVal);
        if (localVal === '' || isNaN(parsed)) { setLocalVal(''); onChange(''); }
        else {
          let c = parsed;
          if (min !== undefined && c < min) c = min;
          if (max !== undefined && c > max) c = max;
          setLocalVal(String(c)); onChange(c);
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
    if (trimmed && !items.includes(trimmed)) { onAdd(trimmed); setValue(''); setShowSug(false); }
  };
  return (
    <div className="space-y-1.5">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {items.map((item) => (
            <span key={item} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${chipClass}`}>
              {item}
              <button onClick={() => onRemove(item)} className="hover:opacity-70 ml-0.5"><X size={10} /></button>
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
          ><Plus size={13} /></button>
        </div>
        {showSug && filtered.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
            {filtered.slice(0, 8).map((s) => (
              <button key={s} onMouseDown={(e) => { e.preventDefault(); handleAdd(s); }}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Breed Input ───────────────────────────────────────────────────
function BreedInput({ value, onChange, species }) {
  const [input, setInput] = useState(value || '');
  const [showSug, setShowSug] = useState(false);
  const [breedList, setBreedList] = useState([]);
  useEffect(() => { setInput(value || ''); }, [value]);
  useEffect(() => {
    if (species === 'dog' || species === 'cat') {
      getBreedsApi(species).then(setBreedList).catch(() => {});
    } else {
      setBreedList([]);
    }
  }, [species]);
  const filtered = breedList.filter(
    (b) => b.breed.toLowerCase().includes(input.toLowerCase()) && b.breed !== input
  );
  return (
    <div className="relative">
      <input
        type="text"
        value={input}
        onChange={(e) => { setInput(e.target.value); onChange(e.target.value); setShowSug(true); }}
        onFocus={() => setShowSug(true)}
        onBlur={() => setTimeout(() => setShowSug(false), 150)}
        placeholder="Mixed/Unknown, or type breed..."
        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300 transition-all"
      />
      {showSug && filtered.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {filtered.slice(0, 10).map((b) => (
            <button key={b.breed} onMouseDown={(e) => { e.preventDefault(); setInput(b.breed); onChange(b.breed); setShowSug(false); }}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between">
              <span>{b.breed}</span>
              {b.mdr1 && <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0 ml-2">⚠ MDR1</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Login / Signup Gate ───────────────────────────────────────────
function AuthGate({ onAuthenticated }) {
  const { login, signup, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) { setError('Please fill in all fields'); return; }
    if (mode === 'signup') {
      if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
      if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    }
    setSubmitting(true);
    const result = mode === 'login'
      ? await login(username.trim(), password)
      : await signup(username.trim(), password);
    setSubmitting(false);
    if (result.ok) { onAuthenticated(); }
    else { setError(result.error || 'Authentication failed'); }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.07)]">
        <div className="max-w-5xl mx-auto px-6 h-[62px] flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 -ml-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <NuvovetWordmark />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="max-w-sm w-full">
          <div className="mx-auto w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
            {mode === 'login' ? <Lock size={24} className="text-slate-500" /> : <UserPlus size={24} className="text-slate-500" />}
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-1 text-center">
            {mode === 'login' ? 'Sign in to Full System' : 'Create an account'}
          </h2>
          <p className="text-sm text-slate-500 mb-6 text-center">
            {mode === 'login' ? 'Access the complete veterinary DUR system' : 'Join to access the full DUR system'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoFocus
                autoComplete="username"
                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Minimum 6 characters' : 'Enter password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full px-4 py-3 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {mode === 'signup' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
                />
              </div>
            )}
            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={submitting}
              className="w-full px-4 py-3 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-all">
              {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-5 text-center">
            {mode === 'login' ? (
              <p className="text-sm text-slate-500">
                Don't have an account?{' '}
                <button onClick={() => { setMode('signup'); setError(''); }} className="font-medium text-slate-800 hover:underline">Create one</button>
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError(''); }} className="font-medium text-slate-800 hover:underline">Sign in</button>
              </p>
            )}
          </div>

          <button onClick={() => navigate('/demo')} className="mt-4 w-full text-xs text-slate-400 hover:text-slate-600 transition-colors text-center block">
            Try Demo instead →
          </button>
        </div>
      </main>
    </div>
  );
}

// ── Load Existing Patient Modal ───────────────────────────────────
function LoadPatientModal({ onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('last_visit');
  const [filterSpecies, setFilterSpecies] = useState('');
  const [visibleColumns, setVisibleColumns] = useState({ breed: true, weight: true, lastVisit: true });
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    let all = getAllPatients();
    if (filterSpecies) all = all.filter(p => p.species === filterSpecies);
    if (query.trim()) {
      const q = query.toLowerCase();
      all = all.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        (p.owner_phone || '').toLowerCase().includes(q) ||
        (p.species || '').toLowerCase().includes(q) ||
        (p.id || '').toLowerCase().includes(q)
      );
    }
    setPatients(sortPatients(all, sortBy));
  }, [query, sortBy, filterSpecies]);

  const speciesLabel = (sp) => {
    const labels = { dog: 'Dog', cat: 'Cat', rabbit: 'Rabbit', hamster: 'Hamster', 'guinea pig': 'Guinea Pig', ferret: 'Ferret', bird: 'Bird', 'turtle/tortoise': 'Turtle', other: 'Other' };
    return labels[sp] || sp;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-12 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Load Existing Patient</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} /></button>
        </div>

        {/* Search + filters */}
        <div className="px-5 py-3 border-b border-slate-100 space-y-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, owner, species, ID..."
              autoFocus
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filterSpecies} onChange={e => setFilterSpecies(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none">
              <option value="">All species</option>
              {['dog','cat','rabbit','hamster','guinea pig','ferret','bird','turtle/tortoise','other'].map(s => (
                <option key={s} value={s}>{speciesLabel(s)}</option>
              ))}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none">
              <option value="last_visit">Recent visit</option>
              <option value="name">Name A–Z</option>
              <option value="species">Species</option>
            </select>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[11px] text-slate-400">Columns:</span>
              {[['breed','Breed'],['weight','Weight'],['lastVisit','Last visit']].map(([k,label]) => (
                <button key={k} onClick={() => setVisibleColumns(v => ({...v, [k]: !v[k]}))}
                  className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${visibleColumns[k] ? 'bg-slate-800 text-white border-slate-800' : 'text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Patient list */}
        <div className="overflow-y-auto max-h-[400px]">
          {patients.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              {query || filterSpecies ? 'No patients match your search' : 'No saved patients yet'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-5 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Patient</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Species</th>
                  {visibleColumns.breed && <th className="text-left px-3 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Breed</th>}
                  {visibleColumns.weight && <th className="text-left px-3 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Weight</th>}
                  {visibleColumns.lastVisit && <th className="text-left px-3 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Last Visit</th>}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((p) => {
                  const lastDate = p.visit_history?.[0]?.date || p.updated_at;
                  return (
                    <tr key={p.id} onClick={() => { onSelect(p); onClose(); }}
                      className="hover:bg-slate-50 cursor-pointer transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{p.name}</p>
                        {p.owner_phone && <p className="text-[11px] text-slate-400 mt-0.5">{p.owner_phone}</p>}
                      </td>
                      <td className="px-3 py-3 text-slate-600 capitalize">{speciesLabel(p.species)}</td>
                      {visibleColumns.breed && <td className="px-3 py-3 text-slate-500 hidden sm:table-cell">{p.breed || <span className="text-slate-300">—</span>}</td>}
                      {visibleColumns.weight && <td className="px-3 py-3 text-slate-500 hidden sm:table-cell">{p.weight_kg != null ? `${p.weight_kg} kg` : <span className="text-slate-300">—</span>}</td>}
                      {visibleColumns.lastVisit && <td className="px-3 py-3 text-slate-400 hidden md:table-cell text-[12px]">{lastDate ? lastDate.split('T')[0] : <span className="text-slate-300">—</span>}</td>}
                      <td className="px-3 py-3"><ChevronRight size={14} className="text-slate-300" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Editable Patient Summary (left col on results) ────────────────
function PatientEditPanel({ patient, drugs, results, onUpdate }) {
  const RENAL_OPTIONS = ['Unknown','Normal','Mild impairment','Moderate impairment','Severe impairment'];
  const HEPATIC_OPTIONS = RENAL_OPTIONS;
  const [editing, setEditing] = useState(null); // field name being edited

  const Field = ({ label, value, fieldKey, type = 'text', options }) => (
    <div className="flex items-start justify-between gap-2 py-1.5 group">
      <span className="text-[11px] text-slate-400 shrink-0 mt-0.5">{label}</span>
      {editing === fieldKey ? (
        <div className="flex items-center gap-1 flex-1 justify-end">
          {options ? (
            <select
              value={value || ''}
              onChange={(e) => { onUpdate({ [fieldKey]: e.target.value }); setEditing(null); }}
              autoFocus
              onBlur={() => setEditing(null)}
              className="text-[12px] border border-slate-300 rounded px-1.5 py-0.5 text-slate-800 focus:outline-none"
            >
              {options.map(o => <option key={o}>{o}</option>)}
            </select>
          ) : (
            <input
              type={type}
              defaultValue={value || ''}
              autoFocus
              onBlur={(e) => { onUpdate({ [fieldKey]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }); setEditing(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(null); }}
              className="text-[12px] border border-slate-300 rounded px-1.5 py-0.5 text-slate-800 w-20 text-right focus:outline-none"
            />
          )}
        </div>
      ) : (
        <button
          onClick={() => setEditing(fieldKey)}
          className="text-[12px] font-medium text-slate-700 hover:text-slate-900 group-hover:underline text-right flex-1 truncate"
        >
          {value || <span className="text-slate-300 italic">—</span>}
        </button>
      )}
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Patient</h3>
        <span className="text-[10px] text-slate-300">click to edit</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-0.5 divide-y divide-slate-100/80">
        <Field label="Name" value={patient.name} fieldKey="name" />
        <Field label="Species" value={patient.species} fieldKey="species"
          options={['dog','cat','rabbit','hamster','guinea pig','ferret','bird','turtle/tortoise','other']} />
        {patient.breed && <Field label="Breed" value={patient.breed} fieldKey="breed" />}
        <Field label="Weight" value={patient.weight ? `${patient.weight} kg` : ''} fieldKey="weight" type="number" />
        {patient.sex && <Field label="Sex" value={patient.sex} fieldKey="sex" options={['Male intact','Male neutered','Female intact','Female spayed','Unknown']} />}
        {patient.age && <Field label="Age" value={patient.age} fieldKey="age" />}
      </div>

      {(patient.conditions?.length > 0 || true) && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Conditions</p>
          <TagInput
            items={patient.conditions || []}
            onAdd={(c) => onUpdate({ conditions: [...(patient.conditions||[]), c] })}
            onRemove={(c) => onUpdate({ conditions: (patient.conditions||[]).filter(x => x !== c) })}
            placeholder="Add condition..."
            chipClass="bg-red-50 text-red-700 border border-red-100"
            suggestions={[]}
          />
        </div>
      )}

      {(patient.allergies?.length > 0 || true) && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Allergies</p>
          <TagInput
            items={patient.allergies || []}
            onAdd={(a) => onUpdate({ allergies: [...(patient.allergies||[]), a] })}
            onRemove={(a) => onUpdate({ allergies: (patient.allergies||[]).filter(x => x !== a) })}
            placeholder="Add allergy..."
            chipClass="bg-amber-50 text-amber-700 border border-amber-100"
            suggestions={[]}
          />
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-0.5 divide-y divide-slate-100/80">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 pb-1.5">Organ Status</p>
        <Field label="Renal" value={patient.renalStatus || 'Unknown'} fieldKey="renalStatus"
          options={RENAL_OPTIONS} />
        <Field label="Hepatic" value={patient.hepaticStatus || 'Unknown'} fieldKey="hepaticStatus"
          options={HEPATIC_OPTIONS} />
        {patient.flaggedLabs?.map((lab, i) => (
          <div key={i} className="flex items-center justify-between py-1.5">
            <span className="text-[11px] text-slate-400">{lab.key}</span>
            <span className={`text-[11px] font-semibold ${lab.status === 'high' ? 'text-red-600' : 'text-amber-600'}`}>
              {lab.value} {lab.unit} {lab.status === 'high' ? '↑' : ''}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
        <OrganLoadIndicator drugs={drugs} patientInfo={patient} species={patient.species} />
      </div>
    </div>
  );
}

// ── Dosage Summary Panel (right col on results) ───────────────────
function DosageSummaryPanel({ results, drugs, species, patientInfo, onUpdateDrug }) {
  const { drugFlags } = results;

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dosage Summary</h3>

      {drugs.map((drug) => {
        const dosePerKg = parseFloat(drug.dosePerKg) || 0;
        const weight = patientInfo?.weight || 0;
        const totalMg = dosePerKg > 0 && weight > 0 ? +(dosePerKg * weight).toFixed(2) : null;
        const range = drug.doseRange?.[species];
        const status = drug.doseStatus || (range && dosePerKg > 0
          ? dosePerKg < range[0] ? 'below' : dosePerKg > range[1] ? 'above' : 'within'
          : null);

        const statusColors = {
          within: 'bg-emerald-50 border-emerald-200 text-emerald-700',
          below:  'bg-orange-50 border-orange-200 text-orange-700',
          above:  'bg-red-50 border-red-200 text-red-700',
        };
        const indicator = { within: '●', below: '↓', above: '↑' };

        return (
          <div key={drug.id} className={`rounded-xl border p-3 shadow-sm ${status ? statusColors[status] : 'bg-white border-slate-200'}`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-[13px] font-semibold text-slate-900 leading-tight">{drug.name}</p>
              {status && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full border ${statusColors[status]}`}>
                  {indicator[status]}
                </span>
              )}
            </div>

            {dosePerKg > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-[12px]">
                  <span className="text-slate-500">Dose</span>
                  <span className="font-semibold text-slate-800">{dosePerKg} mg/kg</span>
                </div>
                {totalMg && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-500">Total</span>
                    <span className="font-semibold text-slate-800">{totalMg} mg</span>
                  </div>
                )}
                {range && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Rec. range</span>
                    <span className="text-slate-500">{range[0]}–{range[1]} mg/kg</span>
                  </div>
                )}
              </div>
            )}

            {status === 'below' && range && (
              <p className="mt-2 text-[11px] font-medium text-orange-700">
                Below recommended range ({range[0]}–{range[1]} mg/kg)
              </p>
            )}
            {status === 'above' && range && (
              <p className="mt-2 text-[11px] font-medium text-red-700">
                Exceeds recommended range ({range[0]}–{range[1]} mg/kg)
              </p>
            )}

            {drug.freq && (
              <p className="mt-1.5 text-[11px] text-slate-400">
                {drug.freq}{drug.route ? ` · ${drug.route}` : ''}{drug.prescriptionDays ? ` · ${drug.prescriptionDays}d` : ''}
              </p>
            )}
          </div>
        );
      })}

      {drugs.length === 0 && (
        <p className="text-[12px] text-slate-400 text-center py-4">No drugs selected</p>
      )}

      {/* Dose alerts in center-column context */}
      {drugs.some(d => d.doseStatus === 'above' || d.doseStatus === 'below') && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">Dosing Alerts</p>
          {drugs.filter(d => d.doseStatus).map((d) => (
            <p key={d.id} className="text-[11px] text-amber-700">
              {d.name}: dose {d.doseStatus === 'above' ? 'exceeds' : 'below'} recommended range
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Full System Main ──────────────────────────────────────────────
export default function FullSystem() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const { user, isAuthenticated, logout } = useAuth();

  // ── Patient state ──────────────────────────────────────────────
  const [patientId, setPatientId] = useState(null);
  const [patientName, setPatientName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerContact, setOwnerContact] = useState('');
  const [species, setSpecies] = useState(null);
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [sex, setSex] = useState('Unknown');
  const [breed, setBreed] = useState('');
  const [ageNum, setAgeNum] = useState('');
  const [ageUnit, setAgeUnit] = useState('years');
  const [reproductiveStatus, setReproductiveStatus] = useState('None');
  const [conditions, setConditions] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [renalStatus, setRenalStatus] = useState('Unknown');
  const [hepaticStatus, setHeptaticStatus] = useState('Unknown');
  const [creatinine, setCreatinine] = useState('');
  const [alt, setAlt] = useState('');

  // ── Drug state ─────────────────────────────────────────────────
  const [drugs, setDrugs] = useState([]);

  // ── UI state ───────────────────────────────────────────────────
  const [showEMRModal, setShowEMRModal] = useState(false);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [saveProfileChecked, setSaveProfileChecked] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importBanner, setImportBanner] = useState(false);
  const [importedFields, setImportedFields] = useState(new Set());

  // ── Flow state ─────────────────────────────────────────────────
  const [step, setStep] = useState('input');
  const [results, setResults] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // ── Suggestions ────────────────────────────────────────────────
  const [conditionSuggestions, setConditionSuggestions] = useState([]);
  const [allergySuggestions, setAllergySuggestions] = useState([]);

  const pollRef = useRef(null);
  const debounceRef = useRef(null);

  // ── Backend polling ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const check = async () => { const ok = await isBackendAvailable(); if (!cancelled) setIsConnected(ok); };
    check();
    pollRef.current = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    getConditionsApi().then(setConditionSuggestions).catch(() => {});
    getAllergiesApi().then(setAllergySuggestions).catch(() => {});
  }, []);

  // ── Auto-rerun on patient detail changes ───────────────────────
  useEffect(() => {
    if (step !== 'results' || drugs.length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const w = getWeightKg();
      const newResults = runFullDURAnalysis(drugs, species, w);
      newResults.wasRefined = true;
      setResults(newResults);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [conditions, allergies, renalStatus, hepaticStatus, creatinine, alt, weight, weightUnit]);

  // ── Drug callbacks ─────────────────────────────────────────────
  const handleAddDrug = useCallback((drug) => setDrugs((prev) => [...prev, drug]), []);
  const handleRemoveDrug = useCallback((drugId) => setDrugs((prev) => prev.filter((d) => d.id !== drugId)), []);
  const handleUpdateDrug = useCallback(
    (drugId, patch) => setDrugs((prev) => prev.map((d) => d.id === drugId ? { ...d, ...patch } : d)), []
  );

  // ── Show auth gate if not authenticated ────────────────────────
  if (!isAuthenticated) {
    return <AuthGate onAuthenticated={() => {}} />;
  }

  // ── Helpers ────────────────────────────────────────────────────
  const getWeightKg = () => {
    const num = typeof weight === 'number' ? weight : parseFloat(weight) || 0;
    return weightUnit === 'g' ? num / 1000 : num;
  };
  const weightKg = getWeightKg();
  const canRun = species && weightKg > 0 && drugs.length > 0;
  const isIntactFemale = sex === 'Intact Female' || sex === 'Female intact';

  const SPECIES_OPTIONS = [
    { value: 'dog',            label: '개 / Canine' },
    { value: 'cat',            label: '고양이 / Feline' },
    { value: 'rabbit',         label: '토끼 / Rabbit' },
    { value: 'hamster',        label: '햄스터 / Hamster' },
    { value: 'guinea pig',     label: '기니피그 / Guinea Pig' },
    { value: 'ferret',         label: '페릿 / Ferret' },
    { value: 'bird',           label: '조류 / Bird' },
    { value: 'turtle/tortoise',label: '거북이 / Turtle' },
    { value: 'other',          label: '기타 / Other' },
  ];

  const SEX_OPTIONS = [
    { value: 'Male intact',    label: '수컷 / Male intact' },
    { value: 'Male neutered',  label: '중성수컷 / Male neutered' },
    { value: 'Female intact',  label: '암컷 / Female intact' },
    { value: 'Female spayed',  label: '중성암컷 / Female spayed' },
  ];

  const RENAL_OPTIONS  = ['Unknown','Normal','Mild impairment','Moderate impairment','Severe impairment'];
  const HEPATIC_OPTIONS = RENAL_OPTIONS;
  const FREQ_OPTIONS   = ['SID','BID','TID','QID','q8h','q12h','PRN','Other'];

  const fieldHighlight = (field) =>
    importedFields.has(field) ? 'ring-2 ring-indigo-300 ring-offset-1' : '';

  const creatVal = parseFloat(creatinine);

  const patientInfo = {
    name: patientName,
    species,
    breed,
    weight: weightKg,
    sex: sex !== 'Unknown' ? sex : undefined,
    age: ageNum ? `${ageNum} ${ageUnit}` : undefined,
    conditions,
    allergies,
    renalStatus,
    hepaticStatus,
    ownerName,
    ownerContact,
    flaggedLabs: creatinine && creatVal > 1.4
      ? [{ key: 'creatinine', value: creatinine, unit: 'mg/dL', status: 'high' }]
      : creatinine && creatVal > 0
      ? [{ key: 'creatinine', value: creatinine, unit: 'mg/dL', status: 'normal' }]
      : [],
  };

  // ── Patient load ───────────────────────────────────────────────
  const handleSelectPatient = (p) => {
    setPatientId(p.id);
    setPatientName(p.name || '');
    setOwnerContact(p.owner_phone || '');
    setSpecies(p.species || null);
    setWeight(p.weight_kg != null ? String(p.weight_kg) : '');
    setWeightUnit('kg');
    setBreed(p.breed || '');
    setSex(p.sex || 'Unknown');
    setAgeNum(p.age_years != null ? String(p.age_years) : '');
    setAgeUnit('years');
    setConditions(p.conditions || []);
    setAllergies(p.allergies || []);
    setCreatinine(p.creatinine_mg_dL != null ? String(p.creatinine_mg_dL) : '');
    setAlt(p.alt_u_L != null ? String(p.alt_u_L) : '');
  };

  const handleSavePatient = () => {
    const profile = savePatient({
      id: patientId || undefined,
      name: patientName || 'Patient',
      owner_phone: ownerContact || null,
      species: species || 'dog',
      breed: breed || null,
      weight_kg: weightKg || null,
      sex: sex !== 'Unknown' ? sex : null,
      age_years: ageNum ? parseFloat(ageNum) : null,
      allergies,
      conditions,
      creatinine_mg_dL: creatinine ? parseFloat(creatinine) : null,
      alt_u_L: alt ? parseFloat(alt) : null,
    });
    setPatientId(profile.id);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleRunAnalysis = () => {
    if (!canRun) return;
    if (saveProfileChecked) handleSavePatient();
    setStep('analyzing');
  };

  const handleAnalysisComplete = () => {
    const analysisResults = runFullDURAnalysis(drugs, species, weightKg);
    setResults(analysisResults);
    setStep('results');
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

  const handlePatientEditUpdate = (patch) => {
    if (patch.name !== undefined) setPatientName(patch.name);
    if (patch.species !== undefined) setSpecies(patch.species);
    if (patch.weight !== undefined) setWeight(String(patch.weight));
    if (patch.breed !== undefined) setBreed(patch.breed);
    if (patch.sex !== undefined) setSex(patch.sex);
    if (patch.conditions !== undefined) setConditions(patch.conditions);
    if (patch.allergies !== undefined) setAllergies(patch.allergies);
    if (patch.renalStatus !== undefined) setRenalStatus(patch.renalStatus);
    if (patch.hepaticStatus !== undefined) setHeptaticStatus(patch.hepaticStatus);
  };

  const handleImportComplete = (data, drugObjects) => {
    const filled = new Set();
    if (data.patient_name) { setPatientName(data.patient_name); filled.add('name'); }
    if (data.owner_phone) { setOwnerContact(data.owner_phone); filled.add('phone'); }
    if (data.species === 'dog' || data.species === 'cat') { setSpecies(data.species); filled.add('species'); }
    if (data.breed) { setBreed(data.breed); filled.add('breed'); }
    if (data.weight_kg != null) { setWeight(String(data.weight_kg)); filled.add('weight'); }
    if (data.sex) { setSex(data.sex); filled.add('sex'); }
    if (data.age_years != null) { setAgeNum(String(data.age_years)); filled.add('age'); }
    if (data.conditions?.length) { setConditions(data.conditions); filled.add('conditions'); }
    if (data.allergies?.length) { setAllergies(data.allergies); filled.add('allergies'); }
    if (data.creatinine_mg_dL != null) { setCreatinine(String(data.creatinine_mg_dL)); filled.add('creatinine'); }
    if (data.alt_u_L != null) { setAlt(String(data.alt_u_L)); filled.add('alt'); }
    if (drugObjects?.length) {
      setDrugs((prev) => {
        const existingIds = new Set(prev.map((d) => d.id));
        return [...prev, ...drugObjects.filter((d) => !existingIds.has(d.id))];
      });
    }
    setImportedFields(filled);
    setImportBanner(true);
  };

  const handleReset = () => {
    setPatientId(null); setPatientName(''); setOwnerName(''); setOwnerContact('');
    setSpecies(null); setWeight(''); setWeightUnit('kg'); setSex('Unknown');
    setBreed(''); setAgeNum(''); setAgeUnit('years'); setReproductiveStatus('None');
    setConditions([]); setAllergies([]); setRenalStatus('Unknown'); setHeptaticStatus('Unknown');
    setCreatinine(''); setAlt('');
    setDrugs([]); setResults(null); setStep('input');
    setSaveProfileChecked(false); setImportBanner(false); setImportedFields(new Set()); setSaveSuccess(false);
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">

      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.07)] shrink-0">
        <div className="px-4 sm:px-6 h-[58px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-2 -ml-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
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
            {user && (
              <span className="hidden sm:inline text-xs text-slate-500 font-medium">
                {user.username}
              </span>
            )}
            <button onClick={() => navigate('/patients')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors">
              <Users size={14} />
              {t.fullSystem.patientsNav}
            </button>
            <LangToggle />
            {step === 'input' && (drugs.length > 0 || patientName) && (
              <button onClick={handleReset} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors" title="Reset">
                <RotateCcw size={14} />
              </button>
            )}
            {/* Sign Out */}
            <button onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
              title="Sign Out">
              <LogOut size={14} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
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
        <EMRImportModal onClose={() => setShowEMRModal(false)} onImport={handleImportComplete} species={species} t={t} />
      )}

      {/* Load Patient Modal */}
      {showPatientModal && (
        <LoadPatientModal onClose={() => setShowPatientModal(false)} onSelect={handleSelectPatient} />
      )}

      {/* Body */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* ANALYZING */}
        {step === 'analyzing' && (
          <AnalysisScreen onComplete={handleAnalysisComplete} drugCount={drugs.length} species={species} />
        )}

        {/* INPUT — Two-panel layout */}
        {step === 'input' && (
          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

            {/* ── LEFT PANEL: Patient Information ── */}
            <div className="w-full lg:w-[400px] lg:shrink-0 lg:border-r border-b lg:border-b-0 border-slate-200 overflow-y-auto bg-white">
              <div className="px-5 py-5 space-y-5">

                {/* Panel header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{t.fullSystem.sectionPatient}</h2>
                    <p className="text-[12px] text-slate-400 mt-0.5">Patient information</p>
                  </div>
                  <button
                    onClick={() => setShowPatientModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:border-slate-300 transition-all"
                  >
                    <Users size={13} />
                    Load Patient
                  </button>
                </div>

                {/* EMR Import */}
                <button
                  onClick={() => setShowEMRModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 border-2 border-dashed border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all bg-white"
                >
                  <Camera size={15} className="text-slate-400" />
                  {t.fullSystem.importFromEMR}
                </button>

                {importBanner && (
                  <div className="flex items-start gap-3 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <AlertCircle size={15} className="text-indigo-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-indigo-800">{t.fullSystem.importBannerTitle}</p>
                      <p className="text-[12px] text-indigo-600 mt-0.5">{t.fullSystem.importBannerDesc}</p>
                    </div>
                    <button onClick={() => setImportBanner(false)} className="text-indigo-400 hover:text-indigo-600"><X size={14} /></button>
                  </div>
                )}

                {/* ── IDENTIFICATION ── */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identification</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-500">Patient Name</label>
                      <input type="text" value={patientName} onChange={e => setPatientName(e.target.value)}
                        placeholder="e.g. 뽀삐"
                        className={`w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300 transition-all ${fieldHighlight('name')}`} />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-500">Patient ID</label>
                      <input type="text" value={patientId || ''} onChange={e => setPatientId(e.target.value)}
                        placeholder="Auto-generated"
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300 transition-all" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-500">Owner Name</label>
                      <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)}
                        placeholder="Owner name"
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300 transition-all" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-500">Owner Contact</label>
                      <input type="text" value={ownerContact} onChange={e => setOwnerContact(e.target.value)}
                        placeholder="010-0000-0000"
                        className={`w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300 transition-all ${fieldHighlight('phone')}`} />
                    </div>
                  </div>
                </div>

                {/* ── SIGNALMENT ── */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Signalment</p>

                  {/* Species */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-500">Species</label>
                    <div className="grid grid-cols-2 gap-2">
                      {SPECIES_OPTIONS.map((sp) => (
                        <button key={sp.value} onClick={() => setSpecies(sp.value)}
                          className={`py-2.5 px-3 rounded-lg border-2 font-medium text-[12px] transition-all text-left ${
                            species === sp.value
                              ? 'border-slate-800 bg-slate-800 text-white shadow-sm'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          } ${fieldHighlight('species')}`}>
                          {sp.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Breed (conditional) */}
                  {species && (
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-500">Breed</label>
                      <div className={fieldHighlight('breed') || ''}>
                        <BreedInput value={breed} onChange={setBreed} species={species} />
                      </div>
                    </div>
                  )}

                  {/* Sex */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-500">Sex</label>
                    <div className="grid grid-cols-2 gap-2">
                      {SEX_OPTIONS.map((opt) => (
                        <button key={opt.value} onClick={() => setSex(sex === opt.value ? 'Unknown' : opt.value)}
                          className={`px-3 py-2 text-[12px] rounded-lg border transition-all ${
                            sex === opt.value ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          } ${fieldHighlight('sex')}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reproductive status — only for intact females */}
                  {isIntactFemale && (
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-500">Reproductive Status</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['None','Pregnant','Lactating'].map(s => (
                          <button key={s} onClick={() => setReproductiveStatus(s)}
                            className={`py-2 px-2 text-[11px] rounded-lg border transition-all font-medium ${
                              reproductiveStatus === s ? 'bg-violet-800 text-white border-violet-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                            }`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Age */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-500">Age</label>
                    <div className="flex gap-2">
                      <DecimalInput value={ageNum} onChange={setAgeNum} placeholder="e.g. 3" min={0} max={30}
                        className={`flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300 ${fieldHighlight('age')}`} />
                      <select value={ageUnit} onChange={e => setAgeUnit(e.target.value)}
                        className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none bg-white text-slate-600">
                        <option value="years">yrs</option>
                        <option value="months">mo</option>
                        <option value="weeks">wks</option>
                      </select>
                    </div>
                  </div>

                  {/* Weight */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-500">{t.fullSystem.weightLabel}</label>
                    <div className="flex gap-2">
                      <DecimalInput value={weight} onChange={setWeight} placeholder={t.fullSystem.weightPlaceholder} min={0.001} max={200}
                        className={`flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300 ${fieldHighlight('weight')}`} />
                      <select value={weightUnit} onChange={e => setWeightUnit(e.target.value)}
                        className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none bg-white text-slate-600">
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── CLINICAL ── */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clinical</p>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-500">Known Conditions / Diseases</label>
                    <TagInput items={conditions} onAdd={(c) => setConditions(p => [...p, c])} onRemove={(c) => setConditions(p => p.filter(x => x !== c))}
                      placeholder="e.g. CKD, Diabetes..."
                      chipClass="bg-red-50 text-red-700 border border-red-100"
                      suggestions={conditionSuggestions} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-500">Known Allergies</label>
                    <TagInput items={allergies} onAdd={(a) => setAllergies(p => [...p, a])} onRemove={(a) => setAllergies(p => p.filter(x => x !== a))}
                      placeholder="e.g. Penicillin, NSAIDs..."
                      chipClass="bg-amber-50 text-amber-700 border border-amber-100"
                      suggestions={allergySuggestions} />
                  </div>

                  {/* Renal status */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-500">
                      Renal Status
                      <span className="ml-1 text-slate-300 font-normal text-[10px]">(default: Unknown)</span>
                    </label>
                    <select value={renalStatus} onChange={e => setRenalStatus(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white text-slate-700">
                      {RENAL_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>

                  {/* Hepatic status */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-500">
                      Hepatic Status
                      <span className="ml-1 text-slate-300 font-normal text-[10px]">(default: Unknown)</span>
                    </label>
                    <select value={hepaticStatus} onChange={e => setHeptaticStatus(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white text-slate-700">
                      {HEPATIC_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>

                  {/* Lab values */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-500">
                        {t.fullSystem.creatinineLabel}
                        <span className="ml-1 text-slate-300 font-normal">{t.fullSystem.creatinineUnit}</span>
                      </label>
                      <DecimalInput value={creatinine} onChange={setCreatinine} placeholder="e.g. 1.2" min={0}
                        className={`w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300 ${fieldHighlight('creatinine')}`} />
                      {creatinine && creatVal > 1.4 && <p className="text-[11px] text-amber-600 font-medium">{t.fullSystem.creatinineIrisHint}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-500">
                        {t.fullSystem.altLabel}
                        <span className="ml-1 text-slate-300 font-normal">{t.fullSystem.altUnit}</span>
                      </label>
                      <DecimalInput value={alt} onChange={setAlt} placeholder="e.g. 45" min={0}
                        className={`w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300 ${fieldHighlight('alt')}`} />
                    </div>
                  </div>
                </div>

                {/* Save profile checkbox */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" checked={saveProfileChecked} onChange={e => setSaveProfileChecked(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-slate-800 focus:ring-slate-500" />
                  <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">
                    {t.fullSystem.saveProfileLabel}
                  </span>
                </label>

              </div>
            </div>

            {/* ── RIGHT PANEL: Drug Prescription ── */}
            <div className="flex-1 overflow-y-auto bg-slate-50/30">
              <div className="px-5 py-5 space-y-5">

                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{t.fullSystem.sectionDrugs}</h2>
                  <p className="text-[12px] text-slate-400 mt-0.5">Select drugs, configure dose</p>
                </div>

                <DrugInput
                  drugs={drugs}
                  onAddDrug={handleAddDrug}
                  onRemoveDrug={handleRemoveDrug}
                  onUpdateDrug={handleUpdateDrug}
                  species={species || 'dog'}
                  weight={weightKg}
                  searchFn={searchDrugsApi}
                />

                <div className="border-t border-slate-200 pt-5 space-y-3">
                  <button
                    onClick={handleRunAnalysis}
                    disabled={!canRun}
                    className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                  >
                    <Zap size={15} />
                    {t.fullSystem.runDurCheck}
                    {drugs.length >= 1 && (
                      <span className="ml-1 text-slate-400 text-xs font-normal">· {drugs.length} {t.results.drugCountLabel}</span>
                    )}
                  </button>
                  {!canRun && (
                    <p className="text-center text-[12px] text-slate-400">{t.fullSystem.runDurDisabledHint}</p>
                  )}
                </div>

              </div>
            </div>

          </div>
        )}

        {/* RESULTS — Three-column layout */}
        {step === 'results' && results && (
          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

            {/* Left column — Editable Patient Summary */}
            <div className="w-full lg:w-[270px] lg:shrink-0 overflow-y-auto border-b lg:border-b-0 lg:border-r border-slate-200 bg-white order-2 lg:order-1">
              <PatientEditPanel
                patient={patientInfo}
                drugs={drugs}
                results={results}
                onUpdate={handlePatientEditUpdate}
              />
            </div>

            {/* Center column — DUR Scan Results */}
            <div className="flex-1 overflow-y-auto order-1 lg:order-2">
              <ResultsDisplay
                results={results}
                onBack={() => setStep('input')}
                onNewAnalysis={() => { setDrugs([]); setResults(null); setStep('input'); }}
                isFullSystem
                drugs={drugs}
                species={species}
                patientInfo={patientInfo}
                onUpdatePatientRecord={patientId ? handleUpdatePatientRecord : null}
                hideSidebar
              />
            </div>

            {/* Right column — Dosage Summary & Organ Load */}
            <div className="w-full lg:w-[260px] lg:shrink-0 overflow-y-auto border-t lg:border-t-0 lg:border-l border-slate-200 bg-white order-3">
              <DosageSummaryPanel
                results={results}
                drugs={drugs}
                species={species}
                patientInfo={patientInfo}
                onUpdateDrug={handleUpdateDrug}
              />
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
