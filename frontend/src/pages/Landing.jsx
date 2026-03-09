import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Lock, ChevronDown, Database, Dna, ShieldCheck,
  FlaskConical, Globe, AlertTriangle, CheckCircle, BookOpen, Zap, Layers,
  Activity, Calculator, Ban, BarChart2, Download, FileText, Printer
} from 'lucide-react';
import { NuvovetLogo, NuvovetWordmark } from '../components/NuvovetLogo';
import { MolecularBackground } from '../components/MolecularBackground';
import { RequestAccessModal } from '../components/RequestAccessModal';
import { useI18n, LangToggle } from '../i18n';

// ── Scroll reveal hook ──────────────────────────────────────────
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

// ── Feature card ────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, description, iconColor = 'text-slate-600', delay = 0 }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={`bg-white border border-slate-200/80 rounded-xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-600 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className={`w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center mb-4 ${iconColor}`}>
        <Icon size={18} />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 mb-1.5">{title}</h3>
      <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

// ── Pipeline item ───────────────────────────────────────────────
function PipelineItem({ number, label, sublabel, delay = 0 }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={`flex items-start gap-3 transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
        {number}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>
      </div>
    </div>
  );
}

// ── New feature visual cards ─────────────────────────────────────

// Organ Load — animated bar chart
function OrganLoadVisual({ visible }) {
  const drugs = [
    { name: 'Meloxicam', renal: 15, hepatic: 60 },
    { name: 'Amoxicillin', renal: 60, hepatic: 10 },
    { name: 'Prednisolone', renal: 20, hepatic: 55 },
    { name: 'Tramadol', renal: 30, hepatic: 45 },
  ];
  const totalRenal = drugs.reduce((s, d) => s + d.renal, 0); // 125
  const totalHepatic = drugs.reduce((s, d) => s + d.hepatic, 0); // 170

  return (
    <div className="bg-slate-900 rounded-lg p-3 text-[10px] space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-slate-400 font-medium uppercase tracking-wide text-[9px]">Organ Burden</span>
        <span className="text-red-400 text-[9px] font-semibold animate-pulse">RENAL HIGH ⚠</span>
      </div>
      <div>
        <div className="flex justify-between text-[9px] mb-0.5">
          <span className="text-slate-400">Renal</span>
          <span className="text-red-400 font-bold">{totalRenal}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 rounded-full transition-all duration-1000"
            style={{ width: visible ? `${Math.min(totalRenal / 2, 100)}%` : '0%' }}
          />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-[9px] mb-0.5">
          <span className="text-slate-400">Hepatic</span>
          <span className="text-amber-400 font-semibold">{totalHepatic}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded-full transition-all duration-1000 delay-200"
            style={{ width: visible ? `${Math.min(totalHepatic / 2, 100)}%` : '0%' }}
          />
        </div>
      </div>
      <div className="pt-1 border-t border-slate-700 grid grid-cols-2 gap-1">
        {drugs.map((d, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-slate-500 shrink-0" />
            <span className="text-slate-500 truncate">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Dose Calculator — interactive slider-like visual
function DoseCalcVisual({ visible }) {
  const [position, setPosition] = useState(50);
  const weight = 28;
  const minMg = +(2.2 * weight).toFixed(0); // 61.6
  const maxMg = +(4.4 * weight).toFixed(0); // 123.2
  const calcMg = Math.round(minMg + (position / 100) * (maxMg - minMg));
  const tablets = Math.round((calcMg / 50) * 10) / 10;

  return (
    <div className="bg-slate-900 rounded-lg p-3 space-y-2.5">
      <div className="flex justify-between text-[9px]">
        <span className="text-slate-400">Carprofen · {weight} kg patient</span>
        <span className="text-blue-400 font-mono">2.2–4.4 mg/kg</span>
      </div>
      {/* Slider track */}
      <div className="relative">
        <div className="h-3 bg-slate-700 rounded-full relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-blue-500 rounded-full transition-all duration-100"
            style={{ width: `${position}%` }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={e => setPosition(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-3"
          style={{ top: 0 }}
        />
        {/* Thumb indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-blue-500 rounded-full shadow pointer-events-none transition-all duration-100"
          style={{ left: `calc(${position}% - 8px)`, top: '50%' }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-slate-500">{minMg} mg min</span>
        <div className="text-center">
          <div className="text-[14px] font-bold text-white font-mono">{calcMg} mg</div>
          <div className="text-[9px] text-blue-400">{tablets} tablets (50mg)</div>
        </div>
        <span className="text-[9px] text-slate-500">{maxMg} mg max</span>
      </div>
    </div>
  );
}

// Species Hardstop — animated alert card
function HardstopVisual({ visible }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setShow(true), 600);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <div className="bg-slate-900 rounded-lg p-3 space-y-2">
      {/* Drug being entered */}
      <div className="flex items-center gap-2 bg-slate-800 rounded-md px-2.5 py-1.5">
        <span className="text-[9px] text-slate-400">Drug entry</span>
        <span className="text-[11px] text-white font-mono ml-auto">Acetaminophen</span>
        <span className="text-[9px] bg-violet-900 text-violet-300 px-1 py-0.5 rounded">🐈 Cat</span>
      </div>
      {/* Alert */}
      <div className={`transition-all duration-500 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
        <div className="bg-red-950 border border-red-500/50 rounded-md px-2.5 py-2 flex items-start gap-2">
          <Ban size={12} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[9px] font-bold text-red-400 uppercase tracking-wide mb-0.5">Species Contraindication</p>
            <p className="text-[9px] text-red-300 leading-relaxed">Acetaminophen is acutely fatal in cats. Cats lack glucuronyl transferase.</p>
          </div>
        </div>
      </div>
      <div className={`transition-all duration-500 delay-300 ${show ? 'opacity-100' : 'opacity-0'}`}>
        <div className="text-[9px] text-slate-500 text-center">⚡ Fires before the scan — not after</div>
      </div>
    </div>
  );
}

// Confidence Provenance — animated bar breakdown
function ConfidenceVisual({ visible }) {
  const drugs = [
    { name: 'Metronidazole', score: 94, source: 'Korean DB', color: 'bg-emerald-500' },
    { name: 'Cyclosporine', score: 71, source: 'Off-label', color: 'bg-amber-400' },
    { name: 'Trazodone', score: 52, source: 'Limited lit.', color: 'bg-red-400' },
  ];
  const blocks = 10;

  return (
    <div className="bg-slate-900 rounded-lg p-3 space-y-2">
      <div className="flex justify-between text-[9px] mb-1">
        <span className="text-slate-400 uppercase tracking-wide font-medium">Confidence Provenance</span>
        <span className="text-slate-300 font-bold">74%</span>
      </div>
      {drugs.map((d, i) => (
        <div key={i} className={`transition-all duration-700`} style={{ transitionDelay: `${i * 200}ms` }}>
          <div className="flex justify-between text-[9px] mb-0.5">
            <span className="text-slate-400">{d.name}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] text-slate-600">{d.source}</span>
              <span className="text-slate-300 font-mono">{d.score}%</span>
            </div>
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: blocks }).map((_, bi) => (
              <div
                key={bi}
                className={`flex-1 h-2 rounded-sm transition-all duration-500 ${bi < Math.round((d.score / 100) * blocks) ? d.color : 'bg-slate-700'}`}
                style={{ transitionDelay: visible ? `${i * 150 + bi * 40}ms` : '0ms', opacity: visible ? 1 : 0 }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// PDF Export — document preview
function PDFExportVisual({ visible }) {
  return (
    <div className="bg-slate-900 rounded-lg p-3">
      {/* Mini document */}
      <div className={`bg-white rounded-md p-2.5 shadow-lg transition-all duration-700 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-slate-900 rounded-sm" />
            <span className="text-[8px] font-bold text-slate-900 uppercase tracking-wide">NUVOVET</span>
          </div>
          <span className="text-[7px] text-slate-400">DUR Report</span>
        </div>
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1 text-[7px]">
            <div><span className="text-slate-400">Patient: </span><span className="font-semibold text-slate-700">Buddy · 28kg</span></div>
            <div><span className="text-slate-400">Date: </span><span className="text-slate-600">2026-03-06</span></div>
          </div>
          <div className="bg-red-50 border-l-2 border-red-500 px-1.5 py-1 rounded-r">
            <span className="text-[7px] text-red-700 font-semibold">Critical: Meloxicam + Prednisolone</span>
          </div>
          <div className="bg-amber-50 border-l-2 border-amber-400 px-1.5 py-1 rounded-r">
            <span className="text-[7px] text-amber-700">Moderate: Metronidazole + Ketoconazole</span>
          </div>
          <div className="h-4 border border-dashed border-slate-200 rounded flex items-center justify-center">
            <span className="text-[6px] text-slate-400">[ Pharmacist signature ]</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-1 mt-2">
        <Printer size={9} className="text-slate-500" />
        <span className="text-[9px] text-slate-500">Print-to-PDF · Goes in patient file</span>
      </div>
    </div>
  );
}

// Pre-Scan Safety Flow
function SafetyLayerVisual({ visible }) {
  const steps = [
    { label: 'Drug entered', color: 'bg-slate-600', delay: 0 },
    { label: 'Hardstop check', color: 'bg-red-500', delay: 200, alert: true },
    { label: 'DDI engine', color: 'bg-amber-500', delay: 400 },
    { label: 'Results', color: 'bg-emerald-500', delay: 600 },
  ];

  return (
    <div className="bg-slate-900 rounded-lg p-3">
      <div className="text-[9px] text-slate-400 mb-3 uppercase tracking-wide font-medium">Pre-Scan Architecture</div>
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            <div
              className={`flex-1 rounded px-1 py-1.5 text-center transition-all duration-500 ${step.color}`}
              style={{ transitionDelay: visible ? `${step.delay}ms` : '0ms', opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(4px)' }}
            >
              <div className="text-[7px] font-medium text-white leading-tight">{step.label}</div>
              {step.alert && <div className="text-[6px] text-red-200 mt-0.5">⛔ blocks</div>}
            </div>
            {i < steps.length - 1 && (
              <div className={`text-slate-600 text-[8px] shrink-0 transition-opacity duration-300`} style={{ transitionDelay: `${step.delay + 150}ms`, opacity: visible ? 1 : 0 }}>→</div>
            )}
          </React.Fragment>
        ))}
      </div>
      <div className={`mt-2 text-[8px] text-slate-500 text-center transition-opacity duration-500 delay-700`} style={{ opacity: visible ? 1 : 0 }}>
        Bright-line toxicity errors are <span className="text-red-400 font-semibold">architecturally separate</span> from interaction warnings
      </div>
    </div>
  );
}

function NewFeatureCard({ icon: Icon, title, description, visual: Visual, iconColor = 'text-slate-600', delay = 0 }) {
  const [ref, visible] = useReveal(0.1);
  return (
    <div
      ref={ref}
      className={`bg-white border border-slate-200/80 rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all duration-600 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 ${iconColor}`}>
          <Icon size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
          <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
        </div>
      </div>
      {Visual && <Visual visible={visible} />}
    </div>
  );
}

// ── Section divider — gradient hairline echoing chart grid lines ─
function SectionDivider() {
  return (
    <div className="overflow-hidden">
      <div className="max-w-5xl mx-auto px-5 sm:px-8">
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200/70 to-transparent" />
      </div>
    </div>
  );
}

// ── Animated counter ────────────────────────────────────────────
function AnimatedStat({ value, label, suffix = '' }) {
  const [ref, visible] = useReveal();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const end = parseInt(value);
    const duration = 1200;
    const step = Math.ceil(end / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [visible, value]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
        {count}{suffix}
      </div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  );
}

// ── Simulated result preview ────────────────────────────────────
function ResultPreview() {
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
      className={`transition-all duration-700 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm max-w-md mx-auto">
        {/* Header bar */}
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
  );
}

// ── Main Landing Page ───────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      {/* ─── Sticky Nav ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.07),0_3px_10px_rgba(15,23,42,0.04)]">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-[62px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <NuvovetWordmark />
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

      {/* ─── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/60 via-blue-50/20 to-[#f5f7fb]">
        <MolecularBackground />

        <div className="relative max-w-5xl mx-auto px-5 sm:px-8 pt-16 sm:pt-24 pb-12 sm:pb-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — text */}
            <div className={`transition-all duration-1000 ease-out ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/80 border border-slate-200 rounded-full text-xs text-slate-500 mb-6 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                {t.landing.heroBadge}
              </div>

              <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight mb-5 ${lang === 'ko' ? 'leading-[1.35]' : 'leading-[1.15]'}`}>
                <span className={lang === 'ko' ? 'block' : 'inline'}>{t.landing.heroTitle}</span>
                <span className={`text-slate-400 ${lang === 'ko' ? 'block mt-1' : 'inline'}`}>{t.landing.heroTitleAccent}</span>
              </h1>

              <p className={`text-base sm:text-lg text-slate-500 mb-8 max-w-lg ${lang === 'ko' ? 'leading-[1.9]' : 'leading-relaxed'}`}>
                {t.landing.heroDesc}
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate('/demo')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  {t.nav.tryDemo}
                  <ArrowRight size={15} />
                </button>
                <button
                  onClick={() => setShowAccessModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-slate-700 text-sm font-medium rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200"
                >
                  {t.nav.requestAccess}
                </button>
              </div>
            </div>

            {/* Right — result preview */}
            <div className={`transition-all duration-1000 delay-300 ease-out ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
              <ResultPreview />
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="flex justify-center pb-6 animate-bounce">
          <ChevronDown size={20} className="text-slate-300" />
        </div>
      </section>

      {/* ─── Stats Bar ──────────────────────────────────────────── */}
      <section className="bg-white shadow-[0_1px_0_0_rgba(15,23,42,0.06),0_-1px_0_0_rgba(15,23,42,0.04)]">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
          <RevealSection>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              <AnimatedStat value="877" label={t.landing.statsProducts} suffix="+" />
              <AnimatedStat value="8" label={t.landing.statsEngines} />
              <AnimatedStat value="10" label={t.landing.statsRules} />
              <AnimatedStat value="2" label={t.landing.statsSpecies} />
            </div>
          </RevealSection>
        </div>
      </section>

      <SectionDivider />

      {/* ─── DUR Engine Features ────────────────────────────────── */}
      <section className="bg-white">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <RevealSection>
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{t.landing.howItWorks}</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
              {t.landing.howItWorksTitle}
            </h2>
            <p className="text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
              {t.landing.howItWorksDesc}
            </p>
          </div>
        </RevealSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            icon={Dna}
            title={t.landing.featureCYP}
            description={t.landing.featureCYPDesc}
            delay={0}
          />
          <FeatureCard
            icon={ShieldCheck}
            title={t.landing.featureDDI}
            description={t.landing.featureDDIDesc}
            delay={100}
          />
          <FeatureCard
            icon={Layers}
            title={t.landing.featureSpecies}
            description={t.landing.featureSpeciesDesc}
            delay={200}
          />
          <FeatureCard
            icon={FlaskConical}
            title={t.landing.featureOffLabel}
            description={t.landing.featureOffLabelDesc}
            iconColor="text-amber-600"
            delay={300}
          />
          <FeatureCard
            icon={Globe}
            title={t.landing.featureForeign}
            description={t.landing.featureForeignDesc}
            iconColor="text-blue-600"
            delay={400}
          />
          <FeatureCard
            icon={AlertTriangle}
            title={t.landing.featureUnknown}
            description={t.landing.featureUnknownDesc}
            iconColor="text-slate-500"
            delay={500}
          />
        </div>
      </div>
      </section>

      <SectionDivider />

      {/* ─── Advanced Clinical Intelligence ─────────────────────── */}
      <section className="bg-gradient-to-b from-[#f5f7fb] via-indigo-50/30 to-[#f5f7fb]">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <RevealSection>
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-full text-xs text-white mb-4">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              {t.landing.newFeaturesLabel}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
              {t.landing.newFeaturesTitle}
            </h2>
            <p className="text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
              {t.landing.newFeaturesDesc}
            </p>
          </div>
        </RevealSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NewFeatureCard
            icon={Activity}
            title={t.landing.featureOrganLoad}
            description={t.landing.featureOrganLoadDesc}
            visual={OrganLoadVisual}
            iconColor="text-red-500"
            delay={0}
          />
          <NewFeatureCard
            icon={Calculator}
            title={t.landing.featureDoseCalc}
            description={t.landing.featureDoseCalcDesc}
            visual={DoseCalcVisual}
            iconColor="text-blue-600"
            delay={100}
          />
          <NewFeatureCard
            icon={Ban}
            title={t.landing.featureHardstops}
            description={t.landing.featureHardstopsDesc}
            visual={HardstopVisual}
            iconColor="text-red-600"
            delay={200}
          />
          <NewFeatureCard
            icon={BarChart2}
            title={t.landing.featureConfidence}
            description={t.landing.featureConfidenceDesc}
            visual={ConfidenceVisual}
            iconColor="text-amber-600"
            delay={300}
          />
          <NewFeatureCard
            icon={FileText}
            title={t.landing.featurePDF}
            description={t.landing.featurePDFDesc}
            visual={PDFExportVisual}
            iconColor="text-emerald-600"
            delay={400}
          />
          <NewFeatureCard
            icon={ShieldCheck}
            title={t.landing.featureSafetyLayer}
            description={t.landing.featureSafetyLayerDesc}
            visual={SafetyLayerVisual}
            iconColor="text-slate-600"
            delay={500}
          />
        </div>
      </div>
      </section>

      <SectionDivider />

      {/* ─── Drug Resolution Pipeline ───────────────────────────── */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
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
                <PipelineItem number="1" label={t.landing.pipeline1} sublabel={t.landing.pipeline1Sub} delay={0} />
                <PipelineItem number="2" label={t.landing.pipeline2} sublabel={t.landing.pipeline2Sub} delay={80} />
                <PipelineItem number="3" label={t.landing.pipeline3} sublabel={t.landing.pipeline3Sub} delay={160} />
                <PipelineItem number="4" label={t.landing.pipeline4} sublabel={t.landing.pipeline4Sub} delay={240} />
                <PipelineItem number="5" label={t.landing.pipeline5} sublabel={t.landing.pipeline5Sub} delay={320} />
                <PipelineItem number="6" label={t.landing.pipeline6} sublabel={t.landing.pipeline6Sub} delay={400} />
              </div>
            </div>

            {/* Visual: severity scale */}
            <RevealSection delay={200}>
              <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-5">{t.landing.severityTitle}</h3>
                <div className="space-y-3">
                  {[
                    { level: t.results.critical, score: '100', color: 'bg-red-500', desc: t.landing.severityCritical },
                    { level: t.results.moderate, score: '40–75', color: 'bg-amber-500', desc: t.landing.severityModerate },
                    { level: t.results.minor, score: '15–39', color: 'bg-yellow-400', desc: t.landing.severityMinor },
                    { level: t.results.none, score: '0', color: 'bg-emerald-500', desc: t.landing.severityNone },
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${s.color} mt-1.5 shrink-0`} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-800">{s.level}</span>
                          <span className="text-xs text-slate-400 font-mono">{s.score}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-5 border-t border-slate-100">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">{t.landing.resultIncludes}</h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    {t.landing.resultItems.map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                        <CheckCircle size={12} className="text-emerald-500 shrink-0" />
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

      {/* ─── Demo Preview ───────────────────────────────────────── */}
      <section className="bg-[#f5f7fb]">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <RevealSection>
          <div className="bg-slate-900 rounded-2xl p-6 sm:p-10 text-center overflow-hidden relative">
            {/* Subtle pattern */}
            <div className="absolute inset-0 opacity-5" style={{
              backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }} />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-xs text-white/70 mb-5">
                <Zap size={12} />
                {t.landing.demoPreviewBadge}
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
                {t.landing.demoPreviewTitle}
              </h2>
              <p className="text-sm text-white/60 max-w-md mx-auto mb-8 leading-relaxed">
                {t.landing.demoPreviewDesc}
              </p>

              <button
                onClick={() => navigate('/demo')}
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-slate-900 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {t.nav.launchDemo}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </RevealSection>
      </div>
      </section>

      <SectionDivider />

      {/* ─── CTA ────────────────────────────────────────────────── */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
          <RevealSection>
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
                {t.landing.ctaTitle}
              </h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
                {t.landing.ctaDesc}
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <button
                  onClick={() => setShowAccessModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all duration-200 shadow-sm"
                >
                  {t.nav.requestAccess}
                  <ArrowRight size={15} />
                </button>
                <button
                  onClick={() => navigate('/system')}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white text-slate-700 text-sm font-medium rounded-xl border border-slate-200 hover:border-slate-300 transition-all duration-200"
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
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
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
