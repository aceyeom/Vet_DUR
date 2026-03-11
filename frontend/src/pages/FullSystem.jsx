import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Lock, Eye, EyeOff, Zap, RotateCcw,
  ChevronDown, Plus, X, User, Calendar, ClipboardList,
  Heart, Shield, FlaskConical, AlertCircle, FileText,
  Stethoscope, Activity, Tag, UserCheck, Pill,
  BookOpen, ChevronsUpDown,
} from 'lucide-react';
import { NuvovetWordmark } from '../components/NuvovetLogo';
import { useI18n, LangToggle } from '../i18n';
import { DrugInput } from '../components/DrugInput';
import { AnalysisScreen } from '../components/AnalysisScreen';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { runFullDURAnalysis } from '../utils/durEngine';
import { SEX_ENUM, PATIENT_STATUS_ENUM } from '../data/emrSchema';
import { BREED_DATA } from '../data/breedProfiles';
import { searchDrugsApi, isBackendAvailable } from '../lib/api';

const SYSTEM_PASSWORD = 'vetdur2025';

const TODAY_ISO = new Date().toISOString().split('T')[0];

const DEFAULT_PATIENT = {
  name: '',
  animalChartId: '',
  species: 'dog',
  breed: '',
  sex: 'Unknown',
  dateOfBirth: '',
  patientStatus: '정상',
  statusChangeDate: '',
  animalRegistrationNumber: '',
  registrationDate: TODAY_ISO,
  lastVisitDate: TODAY_ISO,
  attendingVet: '',
  primaryVet: '',
  weight: 10,
  bodyCondition: '',
  bloodType: '',
  diet: '',
  insuranceGroup: '',
  privateInsuranceNumber: '',
  temperature: '',
  heartRate: '',
  respRate: '',
  labResults: {
    creatinine: { value: '', unit: 'mg/dL', status: 'normal' },
    bun:        { value: '', unit: 'mg/dL', status: 'normal' },
    alt:        { value: '', unit: 'U/L',   status: 'normal' },
    alp:        { value: '', unit: 'U/L',   status: 'normal' },
    glucose:    { value: '', unit: 'mg/dL', status: 'normal' },
    hct:        { value: '', unit: '%',     status: 'normal' },
  },
  conditions: [],
  allergies: [],
  history: '',
};

// ── Utilities ────────────────────────────────────────────────────────────────

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  const now = new Date('2026-03-08');
  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  if (months < 0) { years -= 1; months += 12; }
  if (years < 0) return null;
  return `${years}y ${months}m`;
}

const STATUS_META = {
  '정상': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'Active' },
  '사망': { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500',     label: 'Deceased' },
  '기타': { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400',   label: 'Other' },
};

const BLOOD_TYPES_DOG = ['DEA 1.1+', 'DEA 1.1–', 'DEA 1.2+', 'DEA 1.2–', 'DEA 3', 'DEA 4', 'DEA 7', 'Unknown'];
const BLOOD_TYPES_CAT = ['Type A', 'Type B', 'Type AB', 'Unknown'];

const LAB_MARKERS = ['creatinine', 'bun', 'alt', 'alp', 'glucose', 'hct', 't4', 'bnp', 'phosphorus', 'sodium', 'potassium', 'chloride'];
const LAB_UNITS = { creatinine: 'mg/dL', bun: 'mg/dL', alt: 'U/L', alp: 'U/L', glucose: 'mg/dL', hct: '%', t4: 'μg/dL', bnp: 'pmol/L', phosphorus: 'mg/dL', sodium: 'mEq/L', potassium: 'mEq/L', chloride: 'mEq/L' };

// ── Reusable micro-components ────────────────────────────────────────────────

function FieldRow({ label, children, className = '', hint }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-baseline gap-1.5">
        <label className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-widest leading-none">{label}</label>
        {hint && <span className="text-[9px] text-slate-300 normal-case">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputBase = 'w-full px-2.5 py-1.5 text-[12px] text-slate-800 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all placeholder:text-slate-300 bg-white';

function TInput({ value, onChange, placeholder, readOnly, mono }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder || '—'}
      readOnly={readOnly}
      className={`${inputBase} ${mono ? 'font-mono' : ''} ${readOnly ? 'bg-slate-50 text-slate-500 cursor-default' : ''}`}
    />
  );
}

function NInput({ value, onChange, min, max, step }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      min={min} max={max} step={step ?? 0.1}
      className={inputBase}
    />
  );
}

function DInput({ value, onChange }) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={inputBase}
    />
  );
}

function SInput({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={inputBase}
    >
      {options.map(opt => (
        <option key={typeof opt === 'string' ? opt : opt.value} value={typeof opt === 'string' ? opt : opt.value}>
          {typeof opt === 'string' ? opt : opt.label}
        </option>
      ))}
    </select>
  );
}

// ── Accordion Section ─────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children, defaultOpen = true, badge, accent }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/70 transition-colors group ${accent ? 'bg-red-50/40 hover:bg-red-50/60' : ''}`}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon size={11} className={`${accent ? 'text-red-400' : 'text-slate-400'} group-hover:text-slate-600 transition-colors`} />}
          <span className={`text-[9.5px] font-bold uppercase tracking-widest ${accent ? 'text-red-500' : 'text-slate-500'}`}>{title}</span>
          {badge != null && badge > 0 && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${accent ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{badge}</span>
          )}
        </div>
        <ChevronDown
          size={11}
          className={`text-slate-300 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0.5 space-y-2.5 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

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

// ── Lab Row ───────────────────────────────────────────────────────────────────

function LabRow({ label, labKey, data, onChangeData, onRemove }) {
  const statusCycle = { normal: 'high', high: 'low', low: 'normal' };
  const statusLabel = { normal: 'WNL', high: '↑ H', low: '↓ L' };
  const statusColor = {
    normal: 'bg-slate-50 text-slate-500 border-slate-200',
    high:   'bg-red-50 text-red-600 border-red-200',
    low:    'bg-blue-50 text-blue-600 border-blue-200',
  };

  return (
    <div className="flex items-center gap-2 group">
      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase w-[52px] shrink-0">{label}</span>
      <input
        type="text"
        value={data.value}
        onChange={e => onChangeData(labKey, { ...data, value: e.target.value })}
        placeholder="—"
        className="flex-1 min-w-0 px-2 py-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-300 transition-all placeholder:text-slate-200 bg-white font-mono"
      />
      <span className="text-[9px] text-slate-400 w-10 shrink-0 text-center">{data.unit}</span>
      <button
        onClick={() => onChangeData(labKey, { ...data, status: statusCycle[data.status] })}
        className={`text-[9px] font-bold w-9 py-0.5 rounded border transition-all ${statusColor[data.status]}`}
      >
        {statusLabel[data.status]}
      </button>
      {onRemove && (
        <button onClick={() => onRemove(labKey)} className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-red-400 transition-all">
          <X size={9} />
        </button>
      )}
    </div>
  );
}

// ── Add Lab Modal (inline) ────────────────────────────────────────────────────

function AddLabMarker({ patient, onChange, onClose }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState('');
  const existing = Object.keys(patient.labResults);
  const available = LAB_MARKERS.filter(m => !existing.includes(m));

  const add = (key) => {
    if (!key) return;
    onChange({
      ...patient,
      labResults: {
        ...patient.labResults,
        [key]: { value: '', unit: LAB_UNITS[key] || '', status: 'normal' },
      },
    });
    onClose();
  };

  return (
    <div className="mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-md animate-fade-in">
      <div className="flex gap-1.5 items-center">
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="flex-1 text-[11px] px-2 py-1 border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
        >
          <option value="">{t.fullSystem.selectMarker}</option>
          {available.map(m => <option key={m} value={m}>{m.toUpperCase()} ({LAB_UNITS[m] || '—'})</option>)}
        </select>
        <button onClick={() => add(selected)} disabled={!selected} className="px-2.5 py-1 bg-slate-800 text-white text-[10px] rounded hover:bg-slate-700 disabled:opacity-40 transition-colors">{t.add}</button>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X size={11} /></button>
      </div>
    </div>
  );
}

// ── Conditions suggestions ────────────────────────────────────────────────────

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

// ── Patient Sidebar ───────────────────────────────────────────────────────────

function PatientSidebar({ patient, onChange }) {
  const { t, lang } = useI18n();
  const age = calculateAge(patient.dateOfBirth);
  const statusMeta = STATUS_META[patient.patientStatus] || STATUS_META['기타'];
  const [showAddLab, setShowAddLab] = useState(false);

  const set = (field) => (value) => onChange({ ...patient, [field]: value });
  const setLab = (key, data) => onChange({ ...patient, labResults: { ...patient.labResults, [key]: data } });
  const removeLab = (key) => {
    const next = { ...patient.labResults };
    delete next[key];
    onChange({ ...patient, labResults: next });
  };

  const loadDemoProfile = (breedEntry, speciesKey) => {
    const p = breedEntry.profile;
    const rawLabs = p.labResults || {};
    const normLabs = Object.fromEntries(
      Object.entries(rawLabs).map(([k, v]) => [
        k,
        typeof v === 'object' && v !== null && 'value' in v
          ? v
          : { value: String(v ?? ''), unit: LAB_UNITS[k] || '', status: 'normal' },
      ])
    );
    onChange({
      ...DEFAULT_PATIENT,
      name: p.name || '',
      species: speciesKey,
      breed: breedEntry.breed || '',
      sex: p.sex || 'Unknown',
      weight: p.weight || 10,
      bodyCondition: p.bodyCondition || '',
      temperature: p.temperature || '',
      heartRate: p.heartRate || '',
      respRate: p.respRate || '',
      conditions: p.conditions || [],
      allergies: p.allergies || [],
      history: p.history || '',
      labResults: Object.keys(normLabs).length > 0 ? normLabs : DEFAULT_PATIENT.labResults,
      patientStatus: '정상',
      lastVisitDate: TODAY_ISO,
      animalChartId: `${speciesKey === 'dog' ? 'D' : 'C'}-${Math.floor(1000 + Math.random() * 9000)}`,
    });
  };

  const flaggedLabCount = Object.values(patient.labResults).filter(l => l.status !== 'normal').length;

  return (
    <aside className="w-[372px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">

      {/* ── Patient Header Card ───────────────────────────────────── */}
      <div className="px-4 pt-3.5 pb-3 border-b border-slate-100 bg-gradient-to-b from-slate-50/70 to-white">

        {/* Quick-load dropdown */}
        <div className="mb-3">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
            <BookOpen size={9} className="text-slate-300" />
            {t.fullSystem.quickLoadDemo}
          </label>
          <select
            defaultValue=""
            onChange={e => {
              const [speciesKey, breedId] = (e.target.value || '').split('::');
              const breeds = BREED_DATA[speciesKey] || [];
              const found = breeds.find(b => b.id === breedId);
              if (found) loadDemoProfile(found, speciesKey);
              e.target.value = '';
            }}
            className="w-full px-2.5 py-1.5 text-[11px] border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 text-slate-600"
          >
            <option value="" disabled>{t.fullSystem.selectDemoPatient}</option>
            <optgroup label={`🐕  ${t.species.dog}`}>
              {BREED_DATA.dog.map(b => (
                <option key={b.id} value={`dog::${b.id}`}>
                  {b.profile.name} · {b.breed} · {b.demonstrates.slice(0, 30)}...
                </option>
              ))}
            </optgroup>
            <optgroup label={`🐈  ${t.species.cat}`}>
              {BREED_DATA.cat.map(b => (
                <option key={b.id} value={`cat::${b.id}`}>
                  {b.profile.name} · {b.breed} · {b.demonstrates.slice(0, 30)}...
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Name + Status */}
        <div className="flex items-start gap-2 mb-1.5">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={patient.name}
              onChange={e => set('name')(e.target.value)}
              placeholder={t.fullSystem.patientNamePlaceholder}
              className="w-full text-[17px] font-bold text-slate-900 placeholder:text-slate-300 border-0 border-b border-transparent hover:border-slate-200 focus:border-slate-400 focus:outline-none pb-0.5 bg-transparent transition-colors"
            />
          </div>
          <button
            onClick={() => {
              const next = PATIENT_STATUS_ENUM[(PATIENT_STATUS_ENUM.indexOf(patient.patientStatus) + 1) % PATIENT_STATUS_ENUM.length];
              set('patientStatus')(next);
            }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[9.5px] font-bold border cursor-pointer transition-all hover:opacity-80 ${statusMeta.bg} ${statusMeta.text} ${statusMeta.border}`}
            title="Click to cycle status"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
            {patient.patientStatus} · {statusMeta.label}
          </button>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-slate-500 mt-0.5">
          <span className="capitalize font-semibold text-slate-700">
            {patient.species === 'dog' ? `🐕 ${t.species.dog}` : `🐈 ${t.species.cat}`}
          </span>
          {patient.breed && <><span className="text-slate-300">·</span><span>{patient.breed}</span></>}
          {patient.sex !== 'Unknown' && <><span className="text-slate-300">·</span><span>{patient.sex}</span></>}
          {age && <><span className="text-slate-300">·</span><span className="font-medium text-slate-600">{age}</span></>}
          <span className="text-slate-300">·</span>
          <span className="font-mono font-semibold text-slate-800">{patient.weight} kg</span>
          {patient.animalChartId && (
            <span className="ml-auto font-mono text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              #{patient.animalChartId}
            </span>
          )}
        </div>

        {/* Quick flags */}
        {(flaggedLabCount > 0 || patient.conditions.length > 0 || patient.allergies.length > 0) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {patient.conditions.length > 0 && (
              <span className="text-[9px] font-semibold bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <AlertCircle size={8} />{patient.conditions.length} {patient.conditions.length !== 1 ? t.fullSystem.conditionPlural : t.fullSystem.conditionSingular}
              </span>
            )}
            {flaggedLabCount > 0 && (
              <span className="text-[9px] font-semibold bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <FlaskConical size={8} />{flaggedLabCount} {flaggedLabCount !== 1 ? t.fullSystem.flaggedLabPlural : t.fullSystem.flaggedLabSingular}
              </span>
            )}
            {patient.allergies.length > 0 && (
              <span className="text-[9px] font-semibold bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <Tag size={8} />{patient.allergies.length} {patient.allergies.length !== 1 ? t.fullSystem.allergyPlural : t.fullSystem.allergySingular}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Scrollable Sections ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* IDENTITY */}
        <Section title={t.fullSystem.sectionPatientIdentity} icon={User} defaultOpen>
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label={t.fullSystem.fieldFullName}>
              <TInput value={patient.name} onChange={set('name')} placeholder="Name" />
            </FieldRow>
            <FieldRow label={t.fullSystem.fieldChartId}>
              <TInput value={patient.animalChartId} onChange={set('animalChartId')} placeholder="Auto" mono />
            </FieldRow>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <FieldRow label={t.fullSystem.fieldSpecies}>
              <SInput
                value={patient.species}
                onChange={set('species')}
                options={[{ value: 'dog', label: '🐕 Canine (Dog)' }, { value: 'cat', label: '🐈 Feline (Cat)' }]}
              />
            </FieldRow>
            <FieldRow label={t.fullSystem.fieldBreed}>
              <TInput value={patient.breed} onChange={set('breed')} placeholder="e.g. POODLE/푸들" />
            </FieldRow>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <FieldRow label={t.fullSystem.fieldSex}>
              <SInput value={patient.sex} onChange={set('sex')} options={SEX_ENUM} />
            </FieldRow>
            <FieldRow label={t.fullSystem.fieldDateOfBirth}>
              <DInput value={patient.dateOfBirth} onChange={set('dateOfBirth')} />
            </FieldRow>
          </div>

          {age && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-md">
              <Calendar size={10} className="text-slate-400 shrink-0" />
              <span className="text-[11px] text-slate-600">
                {t.demo.age}: <span className="font-semibold text-slate-800">{age}</span>
                <span className="text-slate-400 ml-1">· {t.fullSystem.ageCalculated}</span>
              </span>
            </div>
          )}

          <FieldRow label={t.fullSystem.fieldPatientStatus}>
            <SInput value={patient.patientStatus} onChange={set('patientStatus')} options={PATIENT_STATUS_ENUM} />
          </FieldRow>

          {patient.patientStatus !== '정상' && (
            <FieldRow label={t.fullSystem.fieldStatusChangeDate}>
              <DInput value={patient.statusChangeDate} onChange={set('statusChangeDate')} />
            </FieldRow>
          )}
        </Section>

        {/* REGISTRATION */}
        <Section title={t.fullSystem.sectionRegistration} icon={ClipboardList} defaultOpen={false}>
          <FieldRow label={t.fullSystem.fieldAnimalRegNo} hint={t.fullSystem.fieldAnimalRegNoHint}>
            <TInput
              value={patient.animalRegistrationNumber}
              onChange={set('animalRegistrationNumber')}
              placeholder="e.g. 41000000257260"
              mono
            />
          </FieldRow>

          <div className="grid grid-cols-2 gap-2">
            <FieldRow label={t.fullSystem.fieldRegDate}>
              <DInput value={patient.registrationDate} onChange={set('registrationDate')} />
            </FieldRow>
            <FieldRow label={t.fullSystem.fieldLastVisit}>
              <DInput value={patient.lastVisitDate} onChange={set('lastVisitDate')} />
            </FieldRow>
          </div>
        </Section>

        {/* MEDICAL TEAM */}
        <Section title={t.fullSystem.sectionMedicalTeam} icon={Stethoscope} defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label={t.fullSystem.fieldAttendingVet}>
              <TInput value={patient.attendingVet} onChange={set('attendingVet')} placeholder="Dr. Kim" />
            </FieldRow>
            <FieldRow label={t.fullSystem.fieldPrimaryVet}>
              <TInput value={patient.primaryVet} onChange={set('primaryVet')} placeholder="Dr. Lee" />
            </FieldRow>
          </div>
        </Section>

        {/* PHYSICAL & NUTRITION */}
        <Section title={t.fullSystem.sectionPhysicalNutrition} icon={Activity} defaultOpen>
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label={t.fullSystem.fieldWeight}>
              <div className="flex items-center gap-1.5">
                <NInput value={patient.weight} onChange={set('weight')} min={0.1} max={200} step={0.1} />
                <span className="text-[10px] text-slate-400 shrink-0">kg</span>
              </div>
            </FieldRow>
            <FieldRow label={t.fullSystem.fieldBCS}>
              <SInput
                value={patient.bodyCondition}
                onChange={set('bodyCondition')}
                options={['', '1/9', '2/9', '3/9', '4/9', '5/9', '6/9', '7/9', '8/9', '9/9']}
              />
            </FieldRow>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <FieldRow label={t.fullSystem.fieldBloodType}>
              <SInput
                value={patient.bloodType}
                onChange={set('bloodType')}
                options={['', ...(patient.species === 'dog' ? BLOOD_TYPES_DOG : BLOOD_TYPES_CAT)]}
              />
            </FieldRow>
            <FieldRow label={t.fullSystem.fieldDiet}>
              <TInput value={patient.diet} onChange={set('diet')} placeholder="e.g. Hills c/d" />
            </FieldRow>
          </div>
        </Section>

        {/* INSURANCE */}
        <Section title={t.fullSystem.sectionInsurance} icon={Shield} defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2">
            <FieldRow label={t.fullSystem.fieldInsuranceGrade}>
              <TInput value={patient.insuranceGroup} onChange={set('insuranceGroup')} placeholder="e.g. 10등급" />
            </FieldRow>
            <FieldRow label={t.fullSystem.fieldPrivateInsuranceNo}>
              <TInput value={patient.privateInsuranceNumber} onChange={set('privateInsuranceNumber')} placeholder="Policy no." mono />
            </FieldRow>
          </div>
        </Section>

        {/* VITALS */}
        <Section title={t.fullSystem.sectionVitals} icon={Heart} defaultOpen>
          <div className="grid grid-cols-3 gap-2">
            <FieldRow label={t.fullSystem.fieldTemp}>
              <TInput value={patient.temperature} onChange={set('temperature')} placeholder="38.5 °C" />
            </FieldRow>
            <FieldRow label={t.fullSystem.fieldHR}>
              <TInput value={patient.heartRate} onChange={set('heartRate')} placeholder="80 bpm" />
            </FieldRow>
            <FieldRow label={t.fullSystem.fieldRR}>
              <TInput value={patient.respRate} onChange={set('respRate')} placeholder="20/min" />
            </FieldRow>
          </div>
        </Section>

        {/* LAB RESULTS */}
        <Section
          title={t.fullSystem.sectionLabResults}
          icon={FlaskConical}
          defaultOpen
          badge={flaggedLabCount || null}
          accent={flaggedLabCount > 0}
        >
          <div className="space-y-1.5">
            {Object.entries(patient.labResults).map(([key, data]) => (
              <LabRow
                key={key}
                label={key.toUpperCase()}
                labKey={key}
                data={data}
                onChangeData={setLab}
                onRemove={['t4', 'bnp', 'phosphorus', 'sodium', 'potassium', 'chloride'].includes(key) ? removeLab : null}
              />
            ))}
          </div>

          {showAddLab ? (
            <AddLabMarker patient={patient} onChange={onChange} onClose={() => setShowAddLab(false)} />
          ) : (
            <button
              onClick={() => setShowAddLab(true)}
              className="mt-1 text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
            >
              <Plus size={10} /> {t.fullSystem.addLabMarker}
            </button>
          )}

          <p className="text-[9.5px] text-slate-300 leading-relaxed">
            {t.fullSystem.labStatusHint}
          </p>
        </Section>

        {/* ACTIVE CONDITIONS */}
        <Section
          title={t.fullSystem.sectionActiveConditions}
          icon={AlertCircle}
          defaultOpen
          badge={patient.conditions.length || null}
          accent={patient.conditions.length > 0}
        >
          <TagInput
            items={patient.conditions}
            onAdd={c => onChange({ ...patient, conditions: [...patient.conditions, c] })}
            onRemove={c => onChange({ ...patient, conditions: patient.conditions.filter(x => x !== c) })}
            placeholder={t.fullSystem.addConditionPlaceholder}
            chipClass="bg-red-50 text-red-700 border border-red-100"
            suggestions={COMMON_CONDITIONS}
          />
        </Section>

        {/* ALLERGIES */}
        <Section
          title={t.fullSystem.sectionKnownAllergies}
          icon={Tag}
          defaultOpen={false}
          badge={patient.allergies.length || null}
        >
          <TagInput
            items={patient.allergies}
            onAdd={a => onChange({ ...patient, allergies: [...patient.allergies, a] })}
            onRemove={a => onChange({ ...patient, allergies: patient.allergies.filter(x => x !== a) })}
            placeholder={t.fullSystem.addAllergyPlaceholder}
            chipClass="bg-amber-50 text-amber-700 border border-amber-100"
            suggestions={COMMON_ALLERGIES}
          />
        </Section>

        {/* CLINICAL HISTORY */}
        <Section title={t.fullSystem.sectionClinicalHistory} icon={FileText} defaultOpen={false}>
          <textarea
            value={patient.history}
            onChange={e => set('history')(e.target.value)}
            placeholder={t.fullSystem.clinicalHistoryPlaceholder}
            rows={5}
            className="w-full px-2.5 py-2 text-[11.5px] text-slate-700 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all resize-none placeholder:text-slate-300 leading-relaxed"
          />
        </Section>

      </div>
    </aside>
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

// ── Full System Main ───────────────────────────────────────────────────────────

export default function FullSystem() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [authenticated, setAuthenticated] = useState(false);
  const [patient, setPatient] = useState(DEFAULT_PATIENT);
  const [drugs, setDrugs] = useState([]);
  const [step, setStep] = useState('input');
  const [results, setResults] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const pollRef = useRef(null);

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

  const handleAddDrug = useCallback((drug) => setDrugs(prev => [...prev, drug]), []);
  const handleRemoveDrug = useCallback((drugId) => setDrugs(prev => prev.filter(d => d.id !== drugId)), []);
  const handleUpdateDrug = useCallback((drugId, patch) => setDrugs(prev => prev.map(d => d.id === drugId ? { ...d, ...patch } : d)), []);

  if (!authenticated) {
    return <PasswordGate onAuthenticate={() => setAuthenticated(true)} />;
  }

  const handleRunAnalysis = () => {
    if (drugs.length < 1) return;
    setStep('analyzing');
  };

  const handleAnalysisComplete = () => {
    const analysisResults = runFullDURAnalysis(drugs, patient.species, patient.weight);
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
    setPatient(DEFAULT_PATIENT);
    setResults(null);
    setStep('input');
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50/30 overflow-hidden">

      {/* ── Sticky Header ─────────────────────────────────────────── */}
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
            {step === 'input' && (drugs.length > 0 || patient.name) && (
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

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Sidebar: Patient Profile ─────────────────────── */}
        <PatientSidebar patient={patient} onChange={setPatient} />

        {/* ── Right Main Area ───────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">

          {/* ── INPUT STEP ─────────────────────────────────────── */}
          {step === 'input' && (
            <div className="max-w-2xl mx-auto px-5 py-6 space-y-6">

              {/* Section: Current Medications */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Pill size={11} className="text-slate-300" />
                    {t.fullSystem.medsSection}
                    {drugs.length > 0 && (
                      <span className="font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">{drugs.length}</span>
                    )}
                  </h3>
                  {patient.name && (
                    <span className="text-[10px] text-slate-400">
                      for <span className="font-semibold text-slate-600">{patient.name}</span>
                      {patient.weight > 0 && <span className="text-slate-400"> · {patient.weight} kg</span>}
                    </span>
                  )}
                </div>

                <DrugInput
                  drugs={drugs}
                  onAddDrug={handleAddDrug}
                  onRemoveDrug={handleRemoveDrug}
                  onUpdateDrug={handleUpdateDrug}
                  species={patient.species}
                  weight={patient.weight}
                  searchFn={searchDrugsApi}
                />
              </div>

              {/* Run Scan */}
              <div className="space-y-2">
                <button
                  onClick={handleRunAnalysis}
                  disabled={drugs.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                >
                  <Zap size={15} />
                  {t.fullSystem.runScan}
                  {drugs.length >= 1 && (
                    <span className="ml-1 text-slate-400 text-xs font-normal">
                      · {drugs.length} {t.results.drugCountLabel}
                    </span>
                  )}
                </button>

                {drugs.length === 0 && (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <Pill size={20} className="text-slate-300" />
                    </div>
                    <p className="text-[12px] text-slate-400 font-medium">{t.fullSystem.noMedications}</p>
                    <p className="text-[11px] text-slate-300 mt-1">
                      {t.fullSystem.addMedicationsHint} {patient.name || t.fullSystem.patientFallback}
                    </p>
                  </div>
                )}
              </div>

              {/* Patient data DUR context summary (visible when drugs added) */}
              {drugs.length >= 1 && (patient.conditions.length > 0 || Object.values(patient.labResults).some(l => l.status !== 'normal')) && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-2">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle size={11} />
                    {t.fullSystem.patientContext}
                  </p>
                  <div className="space-y-1">
                    {patient.conditions.map(c => (
                      <div key={c} className="text-[11px] text-amber-800 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                        {c}
                      </div>
                    ))}
                    {Object.entries(patient.labResults).filter(([, v]) => v.status !== 'normal').map(([key, v]) => (
                      <div key={key} className="text-[11px] text-amber-800 flex items-center gap-1.5">
                        <span className={`w-1 h-1 rounded-full shrink-0 ${v.status === 'high' ? 'bg-red-500' : 'bg-blue-500'}`} />
                        {key.toUpperCase()}: {v.value} {v.unit} ({v.status === 'high' ? t.fullSystem.labElevated : t.fullSystem.labLow})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ANALYZING STEP ─────────────────────────────────── */}
          {step === 'analyzing' && (
            <AnalysisScreen
              onComplete={handleAnalysisComplete}
              drugCount={drugs.length}
              species={patient.species}
            />
          )}

          {/* ── RESULTS STEP ───────────────────────────────────── */}
          {step === 'results' && (
            <ResultsDisplay
              results={results}
              onBack={handleBackToInput}
              onNewAnalysis={handleNewAnalysis}
              isFullSystem
              drugs={drugs}
              species={patient.species}
              patientInfo={{
                name: patient.name,
                species: patient.species,
                breed: patient.breed,
                weight: patient.weight,
                sex: patient.sex,
                age: calculateAge(patient.dateOfBirth),
                conditions: patient.conditions,
                allergies: patient.allergies,
                labResults: patient.labResults,
                history: patient.history,
                attendingVet: patient.attendingVet,
                animalChartId: patient.animalChartId,
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
