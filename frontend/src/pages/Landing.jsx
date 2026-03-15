import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Lock, ChevronDown, Dna, ShieldCheck,
  AlertTriangle, CheckCircle, Zap, Layers,
  Activity, Ban, Timer, Scale, RefreshCcw
} from 'lucide-react';
import { SeverityBadge } from '../components/SeverityBadge';
import { OrganLoadIndicator } from '../components/OrganLoadIndicator';
import { NuvovetLogo } from '../components/NuvovetLogo';
import { MolecularBackground } from '../components/MolecularBackground';
import { RequestAccessModal } from '../components/RequestAccessModal';
import { useI18n, LangToggle } from '../i18n';

// ── Hooks ──────────────────────────────────────────────────────

function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function useCountUp(target, duration, visible) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const end = parseInt(target);
    const step = Math.ceil(end / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [visible, target, duration]);
  return count;
}

function useTypewriter(text, speed, visible) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!visible) { setDisplayed(''); return; }
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, visible]);
  return displayed;
}

function useAutoReplay(intervalMs, visible) {
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => setCycle(c => c + 1), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, visible]);
  return cycle;
}

// ── Reveal wrapper ─────────────────────────────────────────────

function RevealSection({ children, className = '', delay = 0 }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ── Animated stat ──────────────────────────────────────────────

function AnimatedStat({ value, label, suffix = '' }) {
  const [ref, visible] = useReveal();
  const count = useCountUp(value, 1200, visible);
  return (
    <div ref={ref} className="text-center px-4">
      <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-mono">
        {count}{suffix}
      </div>
      <div className="text-[11px] text-slate-400 mt-1.5 uppercase tracking-wider font-medium">{label}</div>
    </div>
  );
}

// ── Illustrative data ──────────────────────────────────────────

const DEMO_DRUGS = [
  {
    id: 'meloxicam', name: 'Meloxicam', class: 'NSAID',
    renalElimination: 0.15, hepaticElimination: 0.85,
    pk: { primaryElimination: 'hepatic' },
    riskFlags: { bleedingRisk: 'high', giUlcer: 'high', nephrotoxic: 'moderate' },
  },
  {
    id: 'prednisolone', name: 'Prednisolone', class: 'Corticosteroid',
    renalElimination: 0.20, hepaticElimination: 0.80,
    pk: { primaryElimination: 'hepatic' },
    riskFlags: { bleedingRisk: 'moderate', giUlcer: 'moderate' },
  },
];
const DEMO_PATIENT = {
  flaggedLabs: [
    { key: 'creatinine', value: '2.4', unit: 'mg/dL', status: 'high' },
  ],
};

// ── DDI Collision Demo ─────────────────────────────────────────

function DDICollisionDemo({ visible }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setPhase(0);
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 900);
    const t3 = setTimeout(() => setPhase(3), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [visible]);

  return (
    <div className="mt-3 space-y-3">
      {/* Pills sliding toward each other */}
      <div className="relative h-12 flex items-center justify-center overflow-hidden">
        <div
          className="absolute left-0 px-3 py-1.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full border border-blue-200 transition-all duration-700 ease-out"
          style={{ transform: phase >= 1 ? 'translateX(calc(50% + 8px))' : 'translateX(-20px)', opacity: phase >= 1 ? 1 : 0 }}
        >
          Meloxicam
        </div>
        <div
          className="absolute right-0 px-3 py-1.5 bg-violet-100 text-violet-700 text-[10px] font-bold rounded-full border border-violet-200 transition-all duration-700 ease-out"
          style={{ transform: phase >= 1 ? 'translateX(calc(-50% - 8px))' : 'translateX(20px)', opacity: phase >= 1 ? 1 : 0 }}
        >
          Prednisolone
        </div>
        {/* Collision flash */}
        {phase >= 2 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-red-400/30" style={{ animation: 'collisionFlash 0.6s ease-out forwards' }} />
          </div>
        )}
      </div>

      {/* Severity result */}
      <div
        className={`transition-all duration-500 ${phase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
      >
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 animate-pulse-glow">
          <div className="flex items-center gap-2 mb-1">
            <SeverityBadge severity={{ label: 'Critical' }} />
            <span className="text-[10px] text-slate-500">NSAID + Corticosteroid GI Risk</span>
          </div>
          <p className="text-xs font-semibold text-slate-800">Meloxicam + Prednisolone</p>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
            GI ulceration risk ×15 vs either drug alone. Add a proton-pump inhibitor.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Animated Organ Load Demo ───────────────────────────────────

function AnimatedOrganLoadDemo({ visible }) {
  const [phase, setPhase] = useState(0);
  const cycle = useAutoReplay(9000, visible);

  useEffect(() => {
    if (!visible) return;
    setPhase(0);
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 2000);
    const t3 = setTimeout(() => setPhase(3), 3500);
    const t4 = setTimeout(() => setPhase(4), 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [visible, cycle]);

  const renalPct = phase >= 3 ? 35 : phase >= 1 ? 15 : 0;
  const hepaticPct = phase >= 3 ? 165 : phase >= 1 ? 85 : 0;
  const isCritical = phase >= 4;

  return (
    <div className="mt-3 space-y-2.5">
      {/* Drug labels sliding in */}
      <div className="flex flex-wrap gap-1.5">
        <div
          className={`transition-all duration-500 ${phase >= 1 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
        >
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[9px] font-bold rounded-full border border-blue-200">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
            Meloxicam
          </span>
        </div>
        <div
          className={`transition-all duration-500 delay-200 ${phase >= 2 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
        >
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-700 text-[9px] font-bold rounded-full border border-violet-200">
            <span className="w-1.5 h-1.5 bg-violet-400 rounded-full" />
            Prednisolone
          </span>
        </div>
      </div>

      {/* Organ bars */}
      <div className="space-y-2">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-slate-500">Renal Burden</span>
            <span className={`text-[10px] font-bold font-mono transition-colors duration-500 ${isCritical ? 'text-red-600' : 'text-slate-600'}`}>
              {renalPct}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${isCritical ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min((renalPct / 200) * 100, 100)}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-slate-500">Hepatic Burden</span>
            <span className="text-[10px] font-bold font-mono text-amber-600">{hepaticPct}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${hepaticPct > 100 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min((hepaticPct / 200) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Critical banner */}
      {isCritical && (
        <div className="animate-bounce-in">
          <div className="bg-red-100 border border-red-200 rounded-lg px-2.5 py-1.5 flex items-center gap-2 animate-pulse-glow">
            <AlertTriangle size={11} className="text-red-600 shrink-0" />
            <span className="text-[9px] font-bold text-red-700 uppercase tracking-wide">
              Critical — Creatinine 2.4 ↑ with 35% renal load
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Species & Breed Demo ───────────────────────────────────────

function SpeciesBreedDemo({ visible }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const t1 = setTimeout(() => setPhase(1), 500);
    const t2 = setTimeout(() => setPhase(2), 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible]);

  return (
    <div className="space-y-2 mt-3">
      <div
        className={`transition-all duration-600 ${phase >= 1 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6'}`}
      >
        <div className="bg-red-950 border border-red-500/50 rounded-lg px-3 py-2 flex items-start gap-2 animate-pulse-glow">
          <Ban size={11} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[9px] font-bold text-red-400 uppercase tracking-wide">Species Hardstop · Cat</p>
            <p className="text-[9px] text-red-300 leading-relaxed">Acetaminophen is acutely fatal. Cats lack glucuronyl transferase.</p>
          </div>
        </div>
      </div>
      <div
        className={`transition-all duration-600 ${phase >= 2 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6'}`}
      >
        <div className="bg-orange-950/60 border border-orange-500/40 rounded-lg px-3 py-2">
          <p className="text-[9px] font-semibold text-orange-400">MDR1 Sensitivity · Ivermectin</p>
          <p className="text-[9px] text-orange-300/80">Collie/Sheltie/ASD — MDR1 mutation confirmed. CNS toxicity risk. Switch to Selamectin.</p>
        </div>
      </div>
    </div>
  );
}

// ── Dosing Demo ────────────────────────────────────────────────

function AnimatedDosingDemo({ visible }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 1200);
    const t3 = setTimeout(() => setPhase(3), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [visible]);

  const weight = 12;
  const normalMg = 2.4;
  const adjustedMg = 1.2;

  return (
    <div className={`mt-3 bg-slate-900 rounded-xl p-3.5 space-y-2.5 transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex justify-between text-[9px] text-slate-400">
        <span>Meloxicam · <span className="font-bold text-white">{phase >= 1 ? `${weight} kg` : '...'}</span></span>
        <span className={`font-bold transition-all duration-500 ${phase >= 2 ? 'text-amber-400 animate-pulse-glow-amber' : 'text-slate-600'}`}>
          {phase >= 2 ? 'Creatinine 2.4 ↑' : ''}
        </span>
      </div>
      <div className="flex gap-2 items-stretch">
        <div className={`flex-1 bg-slate-800 rounded-lg p-2.5 text-center relative transition-all duration-500 ${phase >= 3 ? 'opacity-60' : ''}`}>
          <div className="text-[8px] text-slate-500 mb-0.5">Standard dose</div>
          <div className="text-[14px] font-bold text-slate-300 font-mono">{normalMg} mg</div>
          <div className="text-[8px] text-slate-600">0.2 mg/kg</div>
          {phase >= 3 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-px bg-red-400/60" style={{ animation: 'strikethrough 0.4s ease-out forwards' }} />
            </div>
          )}
        </div>
        <div className={`flex items-center text-slate-600 transition-all duration-500 ${phase >= 3 ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'}`}>
          →
        </div>
        <div className={`flex-1 rounded-lg p-2.5 text-center transition-all duration-700 ${
          phase >= 3 ? 'bg-emerald-950 border border-emerald-600/40 animate-glow-green' : 'bg-slate-800 border border-transparent'
        }`}>
          <div className={`text-[8px] mb-0.5 transition-colors duration-500 ${phase >= 3 ? 'text-emerald-400' : 'text-slate-600'}`}>
            {phase >= 3 ? 'Renal-adjusted' : '—'}
          </div>
          <div className={`text-[14px] font-bold font-mono transition-colors duration-500 ${phase >= 3 ? 'text-emerald-300' : 'text-slate-600'}`}>
            {phase >= 3 ? `${adjustedMg} mg` : '—'}
          </div>
          <div className={`text-[8px] transition-colors duration-500 ${phase >= 3 ? 'text-emerald-500' : 'text-slate-700'}`}>
            {phase >= 3 ? '0.1 mg/kg ×0.5' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Washout Timeline Demo ──────────────────────────────────────

function TimelineWashoutDemo({ visible }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 1000);
    const t3 = setTimeout(() => setPhase(3), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [visible]);

  return (
    <div className={`mt-3 space-y-2.5 transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {/* Timeline SVG */}
      <div className="relative bg-slate-900 rounded-xl p-4 overflow-hidden">
        <svg viewBox="0 0 300 60" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          {/* Timeline base */}
          <line x1="20" y1="40" x2="280" y2="40" stroke="#334155" strokeWidth="1.5" />

          {/* Self-drawing decay curve */}
          <path
            d="M 60,15 C 80,15 100,25 140,35 C 160,40 200,42 280,42"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeDasharray="200"
            strokeDashoffset={phase >= 1 ? '0' : '200'}
            style={{ transition: 'stroke-dashoffset 2s ease-out' }}
          />

          {/* Drug markers */}
          <circle cx="60" cy="40" r="4" fill={phase >= 1 ? '#3b82f6' : '#475569'}
            style={{ transition: 'fill 0.5s' }} />
          <text x="60" y="55" textAnchor="middle" fill="#94a3b8" fontSize="6" fontFamily="DM Sans">Tramadol</text>

          <circle cx="140" cy="40" r="4" fill={phase >= 2 ? '#8b5cf6' : '#475569'}
            style={{ transition: 'fill 0.5s' }} />
          <text x="140" y="55" textAnchor="middle" fill="#94a3b8" fontSize="6" fontFamily="DM Sans">Trazodone</text>

          {/* Washout zone */}
          <rect x="60" y="8" width="80" height="28" rx="4"
            fill="#f59e0b" opacity={phase >= 2 ? 0.1 : 0}
            style={{ transition: 'opacity 0.8s' }} />
          {phase >= 2 && (
            <text x="100" y="22" textAnchor="middle" fill="#f59e0b" fontSize="6" fontWeight="bold" fontFamily="DM Sans">
              WASHOUT ZONE
            </text>
          )}

          {/* Half-life markers */}
          {phase >= 1 && (
            <>
              <text x="80" y="12" fill="#64748b" fontSize="5" fontFamily="DM Mono">t½ 1.8h</text>
              {phase >= 2 && (
                <text x="160" y="12" fill="#64748b" fontSize="5" fontFamily="DM Mono">t½ 3.5h</text>
              )}
            </>
          )}
        </svg>
      </div>

      {/* Warning */}
      <div className={`transition-all duration-600 ${phase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
        <div className="bg-amber-950/60 border border-amber-500/40 rounded-lg px-3 py-2 animate-pulse-glow-amber">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Timer size={10} className="text-amber-400" />
            <span className="text-[9px] font-bold text-amber-400 uppercase">Serotonin Risk — Washout Required</span>
          </div>
          <p className="text-[8px] text-amber-400/70">≥1d washout before starting new serotonergic drug</p>
        </div>
      </div>
    </div>
  );
}

// ── Clinical Feature Card (bento style) ────────────────────────

function BentoCard({ icon: Icon, title, description, demo: Demo, iconColor = 'text-slate-600', className = '', delay = 0 }) {
  const [ref, visible] = useReveal(0.1);
  return (
    <div
      ref={ref}
      className={`bg-white border border-slate-200/60 rounded-2xl p-5 sm:p-6 flex flex-col gap-3 shadow-sm hover:shadow-lg transition-all duration-600 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 ${iconColor}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 mb-1">{title}</h3>
          <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
        </div>
      </div>
      {Demo && <Demo visible={visible} />}
    </div>
  );
}

// ── Pipeline step ──────────────────────────────────────────────

function PipelineStep({ number, label, sublabel, delay = 0, accentColor = 'bg-slate-900' }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={`flex items-start gap-3 transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className={`w-7 h-7 rounded-full ${accentColor} text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5`}>
        {number}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>
      </div>
    </div>
  );
}

// ── Floating Result Preview ────────────────────────────────────

function FloatingResultPreview() {
  const [ref, visible] = useReveal(0.2);
  const [activeAlert, setActiveAlert] = useState(0);
  const { t } = useI18n();

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => setActiveAlert(p => (p + 1) % 3), 3000);
    return () => clearInterval(timer);
  }, [visible]);

  const alerts = [
    { severity: 'Critical', drugs: 'Meloxicam + Prednisolone', rule: 'NSAID + Corticosteroid GI Risk', color: 'border-l-red-500 bg-red-50/50' },
    { severity: 'Moderate', drugs: 'Metronidazole + Ketoconazole', rule: 'CYP3A4 Inhibition', color: 'border-l-amber-500 bg-amber-50/50' },
    { severity: 'Minor', drugs: 'Phenobarbital + Prednisolone', rule: 'CYP Enzyme Induction', color: 'border-l-yellow-400 bg-yellow-50/30' },
  ];

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
    >
      <div className="animate-float">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl shadow-slate-200/50 max-w-md mx-auto transform rotate-1 hover:rotate-0 transition-transform duration-500">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <NuvovetLogo size={14} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-600">{t.results.durReport}</span>
            </div>
            <span className="text-xs text-slate-400">{`3 ${t.results.interactionsFound}`}</span>
          </div>
          {/* Alerts */}
          <div className="p-3 space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`border-l-4 rounded-lg px-3 py-2.5 transition-all duration-500 ${alert.color} ${
                  i === activeAlert ? 'scale-[1.02] shadow-sm' : 'scale-100'
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-semibold ${
                    alert.severity === 'Critical' ? 'text-red-700' :
                    alert.severity === 'Moderate' ? 'text-amber-700' : 'text-yellow-700'
                  }`}>
                    {alert.severity === 'Critical' ? t.results.critical :
                     alert.severity === 'Moderate' ? t.results.moderate : t.results.minor}
                  </span>
                  <span className="text-xs text-slate-400">{alert.rule}</span>
                </div>
                <p className="text-xs text-slate-600 font-medium">{alert.drugs}</p>
              </div>
            ))}
          </div>
          {/* Confidence */}
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-400">{t.results.confidence}</span>
              <span className="font-semibold text-emerald-600">92%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: visible ? '92%' : '0%', transition: 'width 1.5s ease-out 0.5s' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Gradient Severity Bar ──────────────────────────────────────

function GradientSeverityBar() {
  const [ref, visible] = useReveal(0.2);
  const { t } = useI18n();

  const levels = [
    { label: t.results.critical, score: '100', position: '5%', color: 'bg-red-500', textColor: 'text-red-700', desc: t.landing.severityCritical },
    { label: t.results.moderate, score: '40–75', position: '35%', color: 'bg-amber-500', textColor: 'text-amber-700', desc: t.landing.severityModerate },
    { label: t.results.minor, score: '15–39', position: '62%', color: 'bg-yellow-400', textColor: 'text-yellow-700', desc: t.landing.severityMinor },
    { label: t.results.none, score: '0', position: '88%', color: 'bg-emerald-500', textColor: 'text-emerald-700', desc: t.landing.severityNone },
  ];

  return (
    <div ref={ref}>
      {/* Gradient bar */}
      <div className={`h-3 rounded-full bg-gradient-to-r from-red-500 via-amber-400 via-yellow-300 to-emerald-400 transition-all duration-1000 ${visible ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}`}
        style={{ transformOrigin: 'left' }}
      />

      {/* Floating chips */}
      <div className="relative mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {levels.map((level, i) => (
          <div
            key={i}
            className={`bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm transition-all duration-500 ${
              visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: `${300 + i * 150}ms` }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${level.color}`} />
              <span className={`text-sm font-bold ${level.textColor}`}>{level.label}</span>
              <span className="text-[10px] text-slate-400 font-mono ml-auto">{level.score}</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{level.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ── Main Landing Page ──────────────────────────────────────────
// ════════════════════════════════════════════════════════════════

export default function Landing() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f7fb]">

      {/* ─── Sticky Nav ─────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.07)] transition-all duration-700 ${
          heroVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
        }`}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-[62px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[22px] font-black tracking-[-0.045em] text-slate-900 leading-none select-none">
              nuvovet
            </span>
          </div>
          <div className="flex items-center gap-4">
            <LangToggle />
            <button
              onClick={() => navigate('/system')}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors"
            >
              <Lock size={11} />
              {t.fullSystemLabel}
            </button>
            <button
              onClick={() => navigate('/demo')}
              className="px-4 py-2.5 bg-slate-900 text-white text-[11px] font-bold rounded-lg hover:bg-slate-800 transition-all tracking-wide"
            >
              {t.nav.tryDemo}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero — Full Viewport ───────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/60 via-blue-50/30 to-[#f5f7fb] min-h-[calc(100vh-62px)] flex flex-col">
        <MolecularBackground />

        <div className="relative flex-1 flex items-center">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-16 w-full">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

              {/* Left — text with staggered reveals */}
              <div>
                <div className={`transition-all duration-700 ease-out ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/80 border border-slate-200 rounded-full text-xs text-slate-500 mb-6 backdrop-blur-sm">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    {t.landing.heroBadge}
                  </div>
                </div>

                <div className={`transition-all duration-700 ease-out delay-150 ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                  style={{ transitionDelay: '150ms' }}>
                  <h1 className={`text-3xl sm:text-4xl lg:text-[52px] font-black text-slate-900 tracking-tight mb-5 ${lang === 'ko' ? 'leading-[1.35]' : 'leading-[1.1]'}`}>
                    <span className={lang === 'ko' ? 'block' : 'inline'}>{t.landing.heroTitle}</span>
                    <span
                      className={`${lang === 'ko' ? 'block mt-1' : 'inline'}`}
                      style={{
                        background: 'linear-gradient(90deg, #94a3b8, #475569, #94a3b8)',
                        backgroundSize: '200% auto',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        animation: 'shimmer 3s linear infinite',
                      }}
                    >
                      {t.landing.heroTitleAccent}
                    </span>
                  </h1>
                </div>

                <div className={`transition-all duration-700 ease-out ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                  style={{ transitionDelay: '300ms' }}>
                  <p className={`text-base sm:text-lg text-slate-500 mb-8 max-w-lg ${lang === 'ko' ? 'leading-[1.9]' : 'leading-relaxed'}`}>
                    {t.landing.heroDesc}
                  </p>
                </div>

                <div className={`transition-all duration-700 ease-out ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                  style={{ transitionDelay: '450ms' }}>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => navigate('/demo')}
                      className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 hover:scale-[1.02] transition-all duration-200 shadow-lg shadow-slate-900/20"
                    >
                      {t.nav.tryDemo}
                      <ArrowRight size={15} />
                    </button>
                    <button
                      onClick={() => setShowAccessModal(true)}
                      className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-white text-slate-700 text-sm font-medium rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:scale-[1.02] transition-all duration-200"
                    >
                      {t.nav.requestAccess}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right — floating result preview */}
              <div className={`transition-all duration-1000 ease-out ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'}`}
                style={{ transitionDelay: '400ms' }}>
                <FloatingResultPreview />
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar — glass morphism, overlapping bottom */}
        <div className="relative z-10 -mb-10">
          <div className="max-w-4xl mx-auto px-5 sm:px-8">
            <RevealSection>
              <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-2xl shadow-xl shadow-slate-200/30 py-8 px-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <AnimatedStat value="877" label={t.landing.statsProducts} suffix="+" />
                  <AnimatedStat value="8" label={t.landing.statsEngines} />
                  <AnimatedStat value="10" label={t.landing.statsRules} />
                  <AnimatedStat value="2" label={t.landing.statsSpecies} />
                </div>
              </div>
            </RevealSection>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="flex justify-center pb-4 pt-14 animate-bounce">
          <ChevronDown size={20} className="text-slate-300" />
        </div>
      </section>

      {/* ─── Pipeline Section — Clinical-grade Screening ─────────── */}
      <section className="bg-white pt-20 sm:pt-28 overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 pb-20 sm:pb-28">
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-20 items-start">

            {/* Left: text + pipeline flow */}
            <div>
              <RevealSection>
                <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-4">
                  Drug Resolution Pipeline
                </p>
                <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-black text-slate-900 tracking-tight leading-[1.08] mb-5">
                  Clinical-grade<br />
                  <span className="text-slate-300">interaction</span><br />
                  screening.
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed mb-10 max-w-sm">
                  Every drug input passes through a six-stage resolution pipeline — classifying it by origin, applying species-specific pharmacokinetics, then running pairwise interaction checks with dual-source evidence.
                </p>
              </RevealSection>

              {/* Vertical pipeline */}
              <div className="relative pl-9">
                <div className="absolute left-3.5 top-3 bottom-3 w-px bg-gradient-to-b from-indigo-300 via-violet-300 to-emerald-300" />
                {[
                  { label: 'Drug Substance Normalization', sub: 'Three-tier model: active ingredient → drug class → allergy class', color: 'bg-slate-900' },
                  { label: 'Six-Case Origin Classification', sub: 'KR Vet approved · Human off-label · Foreign · Unknown · Multi-drug · Species-specific', color: 'bg-indigo-600' },
                  { label: 'CYP Enzyme Profiling', sub: 'Substrate/inhibitor/inducer analysis across CYP3A4, CYP2D6, CYP1A2, CYP2C9', color: 'bg-violet-600' },
                  { label: 'Pairwise Interaction Matrix', sub: 'Every drug pair checked — DDI, QT stacking, bleeding, serotonin syndrome', color: 'bg-slate-700' },
                  { label: 'Species & Organ Adjustments', sub: 'Canine vs. feline PK parameters, renal/hepatic dose scaling, MDR1 breed flags', color: 'bg-slate-600' },
                  { label: 'Confidence-scored Result', sub: 'Severity classification with source citation and data-quality confidence score', color: 'bg-emerald-600' },
                ].map(({ label, sub, color }, i) => (
                  <PipelineStep key={i} number={i + 1} label={label} sublabel={sub} accentColor={color} delay={i * 100} />
                ))}
              </div>
            </div>

            {/* Right: Substance resolution live demo */}
            <RevealSection delay={200}>
              <div className="space-y-3">
                <SubstanceResolutionDemo />

                {/* Confidence scoring */}
                <ConfidenceBreakdown />

                {/* Species adjustment callout */}
                <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <Dna size={16} className="text-violet-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[12px] font-semibold text-violet-900">Species-specific adjustment</p>
                      <p className="text-[11px] text-violet-700 mt-0.5 leading-relaxed">
                        Feline glucuronidation deficit → dose frequency halved. MDR1 breed flag applied for Collie/Sheltie.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ─── Clinical Informatics — Bento Box ───────────────────── */}
      <section className="bg-gradient-to-b from-[#f5f7fb] to-slate-50 overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28">

          {/* Billboard header */}
          <RevealSection>
            <div className="mb-14 lg:mb-20">
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-5">Clinical Informatics</p>
              <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-8 mb-5">
                <div className="text-[80px] sm:text-[110px] lg:text-[140px] font-black text-slate-900 leading-none tracking-tight select-none" aria-hidden>
                  6
                </div>
                <div className="pb-2 sm:pb-4">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 leading-tight">
                    independent engines.<br />
                    <span className="text-slate-400">One complete prescription review.</span>
                  </h2>
                </div>
              </div>
              <p className="text-base text-slate-500 max-w-2xl leading-relaxed">
                Substance normalization, off-label drug handling, pairwise interaction checks across all drug types, real-time DUR scanning — running in parallel on every submission.
              </p>
            </div>
          </RevealSection>

          {/* Bento grid — organic layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">

            {/* DDI — large card, spans 7 cols */}
            <div className="lg:col-span-7 lg:row-span-2">
              <BentoCard
                icon={ShieldCheck}
                title="Multi-drug interaction check"
                description="Every drug pair evaluated for CYP enzyme conflicts, duplicate class contraindications, QT interval stacking, bleeding risk amplification, and serotonin syndrome — with a 3-tier severity classification and evidence-backed recommendation."
                demo={DDICollisionDemo}
                iconColor="text-red-600"
                className="h-full"
                delay={0}
              />
            </div>

            {/* Organ Load — top right */}
            <div className="lg:col-span-5">
              <BentoCard
                icon={Activity}
                title="Cumulative organ load"
                description="Hepatic and renal elimination burden summed across the full regimen. Escalates to critical when combined organ load exceeds safe thresholds."
                demo={AnimatedOrganLoadDemo}
                iconColor="text-red-500"
                className="h-full"
                delay={100}
              />
            </div>

            {/* Species — bottom right of first group */}
            <div className="lg:col-span-5">
              <BentoCard
                icon={Layers}
                title="Species & breed safety"
                description="Absolute contraindications fire before the scan. MDR1-sensitive breeds flagged per drug."
                demo={SpeciesBreedDemo}
                iconColor="text-violet-600"
                className="h-full"
                delay={200}
              />
            </div>

            {/* Dosing — bottom left */}
            <div className="lg:col-span-5">
              <BentoCard
                icon={Scale}
                title="Weight-adjusted dosing"
                description="Recommended dose calculated from patient weight with renal/hepatic adjustment factors. Dose overrides flagged when outside evidence range."
                demo={AnimatedDosingDemo}
                iconColor="text-blue-600"
                className="h-full"
                delay={300}
              />
            </div>

            {/* Washout — wide bottom */}
            <div className="lg:col-span-7">
              <BentoCard
                icon={RefreshCcw}
                title="Washout & timing advisor"
                description="Half-life-based washout calculations for serotonergic drugs and narrow-therapeutic-index agents. Warns when new drugs are started before washout window closes."
                demo={TimelineWashoutDemo}
                iconColor="text-amber-600"
                className="h-full"
                delay={400}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Severity & Results ──────────────────────────────────── */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <div>
              <RevealSection>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Drug Pipeline</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
                  {t.landing.pipelineTitle}
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed mb-8">
                  {t.landing.pipelineDesc}
                </p>
              </RevealSection>
              <div className="space-y-4">
                <PipelineStep number="1" label={t.landing.pipeline1} sublabel={t.landing.pipeline1Sub} delay={0} />
                <PipelineStep number="2" label={t.landing.pipeline2} sublabel={t.landing.pipeline2Sub} delay={80} />
                <PipelineStep number="3" label={t.landing.pipeline3} sublabel={t.landing.pipeline3Sub} delay={160} />
                <PipelineStep number="4" label={t.landing.pipeline4} sublabel={t.landing.pipeline4Sub} delay={240} />
                <PipelineStep number="5" label={t.landing.pipeline5} sublabel={t.landing.pipeline5Sub} delay={320} />
                <PipelineStep number="6" label={t.landing.pipeline6} sublabel={t.landing.pipeline6Sub} delay={400} />
              </div>
            </div>

            {/* Severity gradient + result includes */}
            <RevealSection delay={200}>
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-5">{t.landing.severityTitle}</h3>
                  <GradientSeverityBar />
                </div>

                <div className="pt-5 border-t border-slate-100">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">{t.landing.resultIncludes}</h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    {t.landing.resultItems.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                        <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ─── Demo Preview CTA — Immersive Dark ──────────────────── */}
      <section className="bg-[#f5f7fb]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
          <RevealSection>
            <div className="bg-slate-900 rounded-3xl p-8 sm:p-14 text-center overflow-hidden relative">
              {/* Drifting particles */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1 h-1 bg-white/20 rounded-full"
                    style={{
                      left: `${5 + (i * 47) % 90}%`,
                      top: `${10 + (i * 31) % 80}%`,
                      animation: `driftUp ${4 + (i % 4) * 1.5}s ease-in-out infinite`,
                      animationDelay: `${(i * 0.7) % 5}s`,
                    }}
                  />
                ))}
              </div>

              {/* Subtle dot pattern */}
              <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
                backgroundSize: '24px 24px'
              }} />

              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-xs text-white/70 mb-6 backdrop-blur-sm">
                  <Zap size={12} />
                  {t.landing.demoPreviewBadge}
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                  {t.landing.demoPreviewTitle}
                </h2>
                <p className="text-sm sm:text-base text-white/50 max-w-lg mx-auto mb-10 leading-relaxed">
                  {t.landing.demoPreviewDesc}
                </p>

                <button
                  onClick={() => navigate('/demo')}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white text-slate-900 text-sm font-bold rounded-xl hover:bg-slate-100 hover:scale-[1.03] transition-all duration-200 shadow-lg"
                >
                  {t.nav.launchDemo}
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ─── Final CTA ──────────────────────────────────────────── */}
      <section className="bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
          <RevealSection>
            <div className="text-center max-w-xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-4">
                {t.landing.ctaTitle}
              </h2>
              <p className="text-sm sm:text-base text-slate-500 mb-10 leading-relaxed">
                {t.landing.ctaDesc}
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <button
                  onClick={() => setShowAccessModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 hover:scale-[1.02] transition-all duration-200 shadow-lg shadow-slate-900/20"
                >
                  {t.nav.requestAccess}
                  <ArrowRight size={15} />
                </button>
                <button
                  onClick={() => navigate('/system')}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-slate-700 text-sm font-medium rounded-xl border border-slate-200 hover:border-slate-300 hover:scale-[1.02] transition-all duration-200"
                >
                  <Lock size={13} />
                  {t.nav.signIn}
                </button>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200/70 bg-slate-100/80">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <NuvovetLogo size={16} className="text-slate-400" />
            <span className="text-xs text-slate-400 font-medium">NUVOVET</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">{t.appTagline}</span>
          </div>
          <p className="text-xs text-slate-400">
            {t.landing.footerDisclaimer}
          </p>
        </div>
      </footer>

      {/* Modal */}
      <RequestAccessModal
        isOpen={showAccessModal}
        onClose={() => setShowAccessModal(false)}
      />
    </div>
  );
}

// ── Substance Resolution Demo (with typing) ────────────────────

function SubstanceResolutionDemo() {
  const [ref, visible] = useReveal(0.15);
  const typedText = useTypewriter('Metronidazole 250mg', 60, visible);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const t1 = setTimeout(() => setPhase(1), 1400);
    const t2 = setTimeout(() => setPhase(2), 2200);
    const t3 = setTimeout(() => setPhase(3), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [visible]);

  return (
    <div ref={ref} className="bg-slate-950 rounded-2xl p-5 text-white overflow-hidden">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Substance Resolution — Live</p>

      {/* Input */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-2 h-2 bg-slate-500 rounded-full animate-gentle-pulse" />
        <div className="text-[11px] text-slate-400">Drug input</div>
      </div>
      <div className="bg-slate-800 rounded-lg px-3 py-2.5 mb-3 ml-5">
        <span className="text-sm font-semibold text-white">{typedText}</span>
        <span className="inline-block w-px h-4 bg-white/60 ml-0.5 animate-pulse align-middle" />
        {phase >= 1 && (
          <span className="ml-2 text-[10px] text-amber-400 font-medium" style={{ animation: 'fadeIn 0.4s ease-out' }}>
            Human off-label
          </span>
        )}
      </div>

      {/* Normalize arrow */}
      <div className={`ml-5 text-slate-600 text-xs mb-3 transition-all duration-500 ${phase >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
        ↓ Normalize
      </div>

      {/* Resolved fields */}
      <div className={`grid grid-cols-3 gap-1.5 ml-5 mb-3 transition-all duration-600 ${phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
        {[
          { label: 'Substance', val: 'Metronidazole', color: 'text-blue-300' },
          { label: 'Class', val: 'Nitroimidazole', color: 'text-violet-300' },
          { label: 'Allergy', val: 'Metronidazole', color: 'text-amber-300' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-slate-800/60 rounded-md px-2 py-1.5">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider">{label}</div>
            <div className={`text-[11px] font-semibold mt-0.5 ${color}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* CYP check */}
      <div className={`ml-5 text-slate-600 text-xs mb-3 transition-all duration-500 ${phase >= 2 ? 'opacity-100' : 'opacity-0'}`}>
        ↓ CYP check: CYP3A4 inhibitor
      </div>

      {/* Interaction found */}
      <div className={`ml-5 transition-all duration-600 ${phase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
        <div className="bg-amber-900/50 border border-amber-600/40 rounded-lg px-3 py-2.5">
          <div className="text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1">Interaction detected</div>
          <div className="text-[11px] text-amber-200 font-medium">Metronidazole + Ketoconazole</div>
          <div className="text-[10px] text-amber-300/80 mt-0.5">CYP3A4 inhibition → Moderate</div>
        </div>
      </div>
    </div>
  );
}

// ── Confidence Breakdown ───────────────────────────────────────

function ConfidenceBreakdown() {
  const [ref, visible] = useReveal(0.15);

  const items = [
    { label: 'Substance match', pct: 95, color: 'bg-emerald-500' },
    { label: 'CYP profile coverage', pct: 88, color: 'bg-emerald-500' },
    { label: 'Species data (dog)', pct: 82, color: 'bg-amber-500' },
    { label: 'Literature source', pct: 74, color: 'bg-amber-500' },
  ];

  return (
    <div ref={ref} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Confidence Breakdown</p>
      {items.map(({ label, pct, color }, i) => (
        <div key={label} className="flex items-center gap-3 mb-2 last:mb-0">
          <span className="text-[11px] text-slate-500 w-36 shrink-0">{label}</span>
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${color}`}
              style={{
                width: visible ? `${pct}%` : '0%',
                transition: `width 1.2s cubic-bezier(0.4, 0, 0.2, 1) ${300 + i * 200}ms`,
              }}
            />
          </div>
          <span className="text-[11px] font-semibold text-slate-700 w-7 text-right">{pct}%</span>
        </div>
      ))}
    </div>
  );
}
