import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, ChevronDown, ChevronUp, Edit2, Trash2,
  Plus, Clock, AlertTriangle, CheckCircle, Zap, User,
} from 'lucide-react';
import { NuvovetWordmark } from '../components/NuvovetLogo';
import { useI18n, LangToggle } from '../i18n';
import {
  getAllPatients,
  deletePatient,
  savePatient,
  sortPatients,
} from '../lib/patientStorage';

// ── Severity badge ────────────────────────────────────────────────
function SeverityDot({ severity }) {
  if (!severity) return <span className="text-[11px] text-slate-400">—</span>;
  const lower = severity.toLowerCase();
  if (lower === 'critical') return <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-100">Critical</span>;
  if (lower === 'moderate') return <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">Moderate</span>;
  if (lower === 'minor') return <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full">Minor</span>;
  return <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">Clear</span>;
}

// ── Inline editable field ─────────────────────────────────────────
function EditableField({ label, value, onSave, type = 'text' }) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value ?? '');

  useEffect(() => { setLocalVal(value ?? ''); }, [value]);

  const handleBlur = () => {
    setEditing(false);
    if (localVal !== (value ?? '')) onSave(localVal);
  };

  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      {editing ? (
        <input
          type={type}
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') handleBlur(); if (e.key === 'Escape') { setLocalVal(value ?? ''); setEditing(false); } }}
          className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white"
          autoFocus
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-sm text-slate-800 hover:text-slate-600 text-left w-full group flex items-center gap-1"
        >
          <span>{localVal || <span className="text-slate-400 italic">—</span>}</span>
          <Edit2 size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      )}
    </div>
  );
}

// ── Patient detail view ────────────────────────────────────────────
function PatientDetail({ patient, onClose, onUpdate, onDelete, onStartVisit }) {
  const { t } = useI18n();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const update = (field, value) => {
    onUpdate({ ...patient, [field]: value });
  };

  const updateNum = (field, rawValue) => {
    const n = parseFloat(rawValue);
    onUpdate({ ...patient, [field]: isNaN(n) ? null : n });
  };

  const SEX_OPTIONS = ['Intact Male', 'Intact Female', 'Neutered Male', 'Spayed Female'];

  return (
    <div className="fixed inset-0 z-40 bg-white flex flex-col">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 h-[58px] flex items-center gap-3">
        <button onClick={onClose} className="p-2 -ml-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{patient.name}</p>
          <p className="text-[11px] text-slate-400">
            {patient.species === 'dog' ? '개' : '고양이'}
            {patient.breed ? ` · ${patient.breed}` : ''}
          </p>
        </div>
        <button
          onClick={onStartVisit}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white text-[13px] font-medium rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Zap size={13} />
          새 방문 시작
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

          {/* Profile fields */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">환자 정보</h3>
            <div className="grid grid-cols-2 gap-4">
              <EditableField label="이름" value={patient.name} onSave={(v) => update('name', v)} />
              <EditableField label="보호자 연락처" value={patient.owner_phone} onSave={(v) => update('owner_phone', v)} />
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">종</p>
                <div className="flex gap-2">
                  {(['dog', 'cat']).map((sp) => (
                    <button
                      key={sp}
                      onClick={() => update('species', sp)}
                      className={`flex-1 py-1.5 text-[12px] rounded-lg border transition-all ${
                        patient.species === sp ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {sp === 'dog' ? '개' : '고양이'}
                    </button>
                  ))}
                </div>
              </div>
              <EditableField label="품종" value={patient.breed} onSave={(v) => update('breed', v)} />
              <EditableField label="체중 (kg)" value={patient.weight_kg != null ? String(patient.weight_kg) : ''} onSave={(v) => updateNum('weight_kg', v)} type="text" />
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">성별</p>
                <select
                  value={patient.sex || ''}
                  onChange={(e) => update('sex', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white"
                >
                  <option value="">—</option>
                  {SEX_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <EditableField label="나이 (세)" value={patient.age_years != null ? String(patient.age_years) : ''} onSave={(v) => updateNum('age_years', v)} type="text" />
              <EditableField label="크레아티닌 (mg/dL)" value={patient.creatinine_mg_dL != null ? String(patient.creatinine_mg_dL) : ''} onSave={(v) => updateNum('creatinine_mg_dL', v)} type="text" />
              <EditableField label="ALT (U/L)" value={patient.alt_u_L != null ? String(patient.alt_u_L) : ''} onSave={(v) => updateNum('alt_u_L', v)} type="text" />
            </div>
          </section>

          {/* Visit history */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
              방문 기록 ({patient.visit_history?.length ?? 0}건)
            </h3>
            {!patient.visit_history?.length ? (
              <p className="text-[13px] text-slate-400">방문 기록이 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {patient.visit_history.map((visit, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-start gap-3">
                    <Clock size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-medium text-slate-700">
                          {new Date(visit.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                        <SeverityDot severity={visit.dur_summary} />
                      </div>
                      {visit.drugs?.length > 0 && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{visit.drugs.join(', ')}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Delete */}
          <section className="pt-2 border-t border-slate-100">
            {confirmDelete ? (
              <div className="flex items-center gap-3">
                <p className="text-sm text-slate-700">정말 삭제하시겠습니까?</p>
                <button
                  onClick={() => { onDelete(patient.id); onClose(); }}
                  className="px-3 py-1.5 text-[13px] font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                >
                  삭제
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 text-[13px] text-slate-600 hover:text-slate-800 transition-colors"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-[13px] text-red-500 hover:text-red-700 transition-colors"
              >
                <Trash2 size={14} />
                프로필 삭제
              </button>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}

// ── Main Patients Page ────────────────────────────────────────────
export default function Patients() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();

  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('last_visit');
  const [selectedPatient, setSelectedPatient] = useState(null);

  const reload = useCallback(() => {
    const all = getAllPatients();
    setPatients(all);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const filtered = patients.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.owner_phone ?? '').toLowerCase().includes(q)
    );
  });

  const sorted = sortPatients(filtered, sortBy);

  const handleDelete = (id) => {
    deletePatient(id);
    reload();
  };

  const handleUpdate = (updated) => {
    savePatient(updated);
    reload();
    setSelectedPatient(updated);
  };

  const handleStartVisit = (patient) => {
    // Navigate to /system with patient pre-loaded via state
    navigate('/system', { state: { preloadPatientId: patient.id } });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.07)]">
        <div className="px-4 sm:px-6 h-[58px] flex items-center gap-3">
          <button
            onClick={() => navigate('/system')}
            className="p-2 -ml-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <NuvovetWordmark />
            <span className="hidden sm:inline text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
              환자 목록 / Patients
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <LangToggle />
          </div>
        </div>
      </header>

      {/* Detail overlay */}
      {selectedPatient && (
        <PatientDetail
          patient={selectedPatient}
          onClose={() => { setSelectedPatient(null); reload(); }}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onStartVisit={() => handleStartVisit(selectedPatient)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-slate-900">환자 목록</h1>
          <button
            onClick={() => navigate('/system')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white text-[13px] font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Plus size={14} />
            새 환자
          </button>
        </div>

        {/* Search + sort */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="환자 이름 또는 보호자 연락처 검색..."
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white placeholder:text-slate-300 transition-all"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 bg-white text-slate-600 transition-all"
          >
            <option value="last_visit">최근 방문순</option>
            <option value="name">이름순</option>
            <option value="species">종별</option>
          </select>
        </div>

        {/* Patient list */}
        {sorted.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <User size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">{query ? '검색 결과가 없습니다.' : '저장된 환자가 없습니다.'}</p>
            {!query && (
              <button
                onClick={() => navigate('/system')}
                className="mt-4 text-sm text-slate-600 underline hover:text-slate-800 transition-colors"
              >
                DUR 검사 실행 중 환자 프로필을 저장하세요
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((p) => {
              const lastVisit = p.visit_history?.[0];
              const lastVisitDate = lastVisit?.date
                ? new Date(lastVisit.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
                : p.updated_at
                ? new Date(p.updated_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
                : '—';

              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPatient(p)}
                  className="w-full text-left bg-white border border-slate-200 rounded-xl px-4 py-3.5 hover:border-slate-300 hover:shadow-sm transition-all flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[14px] font-semibold text-slate-900 truncate">{p.name}</span>
                      <span className="text-[12px] text-slate-500 shrink-0">
                        {p.species === 'dog' ? '개' : '고양이'}
                        {p.breed ? ` · ${p.breed}` : ''}
                        {p.weight_kg ? ` · ${p.weight_kg} kg` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock size={11} className="text-slate-400 shrink-0" />
                      <span className="text-[11px] text-slate-400">{lastVisitDate}</span>
                      {lastVisit && <SeverityDot severity={lastVisit.dur_summary} />}
                    </div>
                  </div>
                  <ChevronDown size={14} className="text-slate-300 shrink-0 -rotate-90" />
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
