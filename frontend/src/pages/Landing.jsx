import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Lock, ChevronDown, Dna, ShieldCheck,
  FlaskConical, Globe, AlertTriangle, CheckCircle, Zap, Layers,
  Activity, Ban, Timer, Scale, RefreshCcw
} from 'lucide-react';
import { SeverityBadge } from '../components/SeverityBadge';
import { OrganLoadIndicator } from '../components/OrganLoadIndicator';
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

// ── Illustrative data for landing page mini-demos ────────────────
// Dog · 12 kg · Meloxicam + Prednisolone · Elevated creatinine
// Hardcoded illustrative data is acceptable on the marketing page.
const DEMO_DRUGS = [
  {
    id: 'meloxicam',
    name: 'Meloxicam',
    class: 'NSAID',
    renalElimination: 0.15,
    hepaticElimination: 0.85,
    pk: { primaryElimination: 'hepatic' },
    riskFlags: { bleedingRisk: 'high', giUlcer: 'high', nephrotoxic: 'moderate' },
  },
  {
    id: 'prednisolone',
    name: 'Prednisolone',
    class: 'Corticosteroid',
    renalElimination: 0.20,
    hepaticElimination: 0.80,
    pk: { primaryElimination: 'hepatic' },
    riskFlags: { bleedingRisk: 'moderate', giUlcer: 'moderate' },
  },
];
const DEMO_PATIENT = {
  flaggedLabs: [
    { key: 'creatinine', value: '2.4', unit: 'mg/dL', status: 'high' },
  ],
};

// ── DDI mini-demo — severity badges for the illustrative interaction
function DDIDemo({ visible }) {
  const interaction = {
    severity: { label: 'Critical' },
    rule: 'NSAID + Corticosteroid GI Risk',
    drugA: 'Meloxicam',
    drugB: 'Prednisolone',
  };
  return (
    <div className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
      <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mt-2">
        <div className="flex items-center gap-2 mb-1.5">
          <SeverityBadge severity={interaction.severity} />
          <span className="text-[10px] text-slate-500">{interaction.rule}</span>
        </div>
        <p className="text-xs font-semibold text-slate-800">{interaction.drugA} + {interaction.drugB}</p>
        <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
          GI ulceration risk ×15 vs either drug alone. Add a proton-pump inhibitor.
        </p>
      </div>
    </div>
  );
}

// ── Organ Load mini-demo — use the actual OrganLoadIndicator component
function OrganLoadDemo({ visible }) {
  return (
    <div className={`transition-all duration-700 delay-100 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
      <div className="mt-2">
        <OrganLoadIndicator drugs={DEMO_DRUGS} patientInfo={DEMO_PATIENT} />
      </div>
    </div>
  );
}

// ── Species & Breed Safety mini-demo
function SpeciesBreedDemo({ visible }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setShow(true), 500);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <div className="space-y-1.5 mt-2">
      {/* Hardstop */}
      <div className={`transition-all duration-500 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
        <div className="bg-red-950 border border-red-500/50 rounded-lg px-2.5 py-2 flex items-start gap-2">
          <Ban size={11} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[9px] font-bold text-red-400 uppercase tracking-wide">Species Hardstop · Cat</p>
            <p className="text-[9px] text-red-300 leading-relaxed">Acetaminophen is acutely fatal. Cats lack glucuronyl transferase.</p>
          </div>
        </div>
      </div>
      {/* MDR1 */}
      <div className={`transition-all duration-500 delay-200 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
        <div className="bg-orange-950/60 border border-orange-500/40 rounded-lg px-2.5 py-2">
          <p className="text-[9px] font-semibold text-orange-400">MDR1 Sensitivity · Ivermectin</p>
          <p className="text-[9px] text-orange-300/80">Collie/Sheltie/ASD — MDR1 mutation confirmed. CNS toxicity risk. Switch to Selamectin.</p>
        </div>
      </div>
    </div>
  );
}

// ── Weight-Adjusted Dosing mini-demo
function DosingDemo({ visible }) {
  const weight = 12; // illustrative patient
  const normalDose = 0.2; // mg/kg
  const renalFactor = 0.5; // elevated creatinine → halve dose
  const adjustedDose = normalDose * renalFactor;
  const normalMg = +(normalDose * weight).toFixed(1);
  const adjustedMg = +(adjustedDose * weight).toFixed(1);

  return (
    <div className={`mt-2 bg-slate-900 rounded-lg p-3 space-y-2 transition-all duration-700 delay-100 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex justify-between text-[9px] text-slate-400">
        <span>Meloxicam · <span className="font-semibold text-white">{weight} kg</span></span>
        <span className="text-amber-400 font-semibold">Creatinine 2.4 ↑</span>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 bg-slate-800 rounded-md p-2 text-center">
          <div className="text-[8px] text-slate-500 mb-0.5 line-through">Standard dose</div>
          <div className="text-[13px] font-bold text-slate-400 font-mono line-through">{normalMg} mg</div>
          <div className="text-[8px] text-slate-600">{normalDose} mg/kg</div>
        </div>
        <div className="flex items-center text-slate-600">→</div>
        <div className="flex-1 bg-emerald-950 border border-emerald-600/40 rounded-md p-2 text-center">
          <div className="text-[8px] text-emerald-400 mb-0.5">Renal-adjusted</div>
          <div className="text-[13px] font-bold text-emerald-300 font-mono">{adjustedMg} mg</div>
          <div className="text-[8px] text-emerald-500">{adjustedDose} mg/kg ×0.5</div>
        </div>
      </div>
    </div>
  );
}

// ── Washout Advisor mini-demo
function WashoutDemo({ visible }) {
  const drugs = [
    { name: 'Tramadol', halfLife: 1.8, washoutDays: 1, serotonin: true },
    { name: 'Trazodone', halfLife: 3.5, washoutDays: 1, serotonin: true },
  ];

  return (
    <div className={`mt-2 space-y-2 transition-all duration-700 delay-100 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="bg-amber-950/60 border border-amber-500/40 rounded-lg px-2.5 py-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Timer size={10} className="text-amber-400" />
          <span className="text-[9px] font-bold text-amber-400 uppercase">Serotonin Risk — Washout Required</span>
        </div>
        {drugs.map((d, i) => (
          <div key={i} className="flex items-center justify-between text-[9px] py-0.5">
            <span className="text-slate-300">{d.name}</span>
            <span className="text-slate-400">t½ {d.halfLife}h</span>
            <span className="text-amber-300 font-semibold">≥{Math.max(1, Math.ceil(d.halfLife * 5 / 24))}d washout</span>
          </div>
        ))}
        <p className="text-[8px] text-amber-400/70 mt-1">Do not start new serotonergic drug during washout window</p>
      </div>
    </div>
  );
}

// ── Clinical Feature Card with scrollytelling ────────────────────
function ClinicalFeatureCard({ icon: Icon, title, description, demo: Demo, iconColor = 'text-slate-600', delay = 0 }) {
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
      {Demo && <Demo visible={visible} />}
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

      {/* ─── Clinical Informatics — 5 Real Features ─────────────── */}
      <section className="bg-gradient-to-b from-[#f5f7fb] via-indigo-50/30 to-[#f5f7fb]">
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <RevealSection>
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-900 rounded-full text-xs text-white mb-4">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              {t.landing.clinicalFeaturesLabel}
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
              {t.landing.clinicalFeaturesTitle}
            </h2>
            <p className="text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
              {t.landing.clinicalFeaturesDesc}
            </p>
          </div>
        </RevealSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ClinicalFeatureCard
            icon={ShieldCheck}
            title={t.landing.featureDDI}
            description={t.landing.featureDDIDesc}
            demo={DDIDemo}
            iconColor="text-red-600"
            delay={0}
          />
          <ClinicalFeatureCard
            icon={Activity}
            title={t.landing.featureOrganLoad}
            description={t.landing.featureOrganLoadDesc}
            demo={OrganLoadDemo}
            iconColor="text-red-500"
            delay={100}
          />
          <ClinicalFeatureCard
            icon={Layers}
            title={t.landing.featureSpeciesBreed}
            description={t.landing.featureSpeciesBreedDesc}
            demo={SpeciesBreedDemo}
            iconColor="text-violet-600"
            delay={200}
          />
          <ClinicalFeatureCard
            icon={Scale}
            title={t.landing.featureDosing}
            description={t.landing.featureDosingDesc}
            demo={DosingDemo}
            iconColor="text-blue-600"
            delay={300}
          />
          <ClinicalFeatureCard
            icon={RefreshCcw}
            title={t.landing.featureWashout}
            description={t.landing.featureWashoutDesc}
            demo={WashoutDemo}
            iconColor="text-amber-600"
            delay={400}
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
