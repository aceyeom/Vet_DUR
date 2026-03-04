import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, ArrowRight, Lock, ChevronDown, Database, Dna, ShieldCheck,
  FlaskConical, Globe, AlertTriangle, CheckCircle, BookOpen, Zap, Layers
} from 'lucide-react';
import { RequestAccessModal } from '../components/RequestAccessModal';

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
      className={`bg-white border border-slate-200/80 rounded-xl p-5 sm:p-6 transition-all duration-600 ease-out ${
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
            <Shield size={14} className="text-slate-500" />
            <span className="text-xs font-semibold text-slate-600">DUR Analysis Report</span>
          </div>
          <span className="text-xs text-slate-400">3 interactions found</span>
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
                  {alert.severity}
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
            <span className="text-slate-400">Confidence</span>
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
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* ─── Sticky Nav ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <Shield size={15} className="text-white" />
            </div>
            <span className="text-sm font-bold text-slate-900 tracking-tight">VetDUR</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/system')}
              className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              <Lock size={11} />
              Full System
            </button>
            <button
              onClick={() => navigate('/demo')}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-all"
            >
              Try Demo
            </button>
          </div>
        </div>
      </header>

      {/* ─── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Subtle grid background */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }} />

        <div className="max-w-5xl mx-auto px-5 sm:px-8 pt-16 sm:pt-24 pb-12 sm:pb-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — text */}
            <div className={`transition-all duration-1000 ease-out ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-500 mb-6">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Veterinary Drug Utilization Review
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight leading-[1.15] mb-5">
                Real-time drug interaction screening for
                <span className="text-slate-400"> companion animals</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-500 leading-relaxed mb-8 max-w-lg">
                Screen multi-drug prescriptions against 877 Korean veterinary products with CYP-based interaction analysis, species-specific dosing, and evidence-backed recommendations.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate('/demo')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  Try Demo
                  <ArrowRight size={15} />
                </button>
                <button
                  onClick={() => setShowAccessModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-slate-700 text-sm font-medium rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200"
                >
                  Request Full Access
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
      <section className="border-y border-slate-100 bg-slate-50/50">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
          <RevealSection>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              <AnimatedStat value="877" label="Registered Drugs" suffix="+" />
              <AnimatedStat value="8" label="DUR Rule Engines" />
              <AnimatedStat value="10" label="Interaction Rules" />
              <AnimatedStat value="2" label="Species (Dog & Cat)" />
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ─── DUR Engine Features ────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <RevealSection>
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">How It Works</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
              Clinical-grade interaction screening
            </h2>
            <p className="text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
              Every prescription is evaluated through multiple DUR engines — from CYP enzyme profiling to species-specific pharmacokinetics.
            </p>
          </div>
        </RevealSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <FeatureCard
            icon={Dna}
            title="CYP Enzyme Profiling"
            description="Detects interactions through CYP3A4, CYP2D6, CYP1A2, and CYP2C9 substrate/inhibitor/inducer analysis."
            delay={0}
          />
          <FeatureCard
            icon={ShieldCheck}
            title="Pairwise DDI Screening"
            description="Evaluates every drug pair for contraindications, duplicate therapy, QT stacking, bleeding risk, and serotonin syndrome."
            delay={100}
          />
          <FeatureCard
            icon={Layers}
            title="Species-Specific Dosing"
            description="Applies canine vs. feline pharmacokinetic parameters. Flags drugs not approved for the selected species."
            delay={200}
          />
          <FeatureCard
            icon={FlaskConical}
            title="Off-Label Drug Support"
            description="Handles human drugs used in veterinary practice with appropriate confidence flags and advisory notes."
            iconColor="text-amber-600"
            delay={300}
          />
          <FeatureCard
            icon={Globe}
            title="Foreign Drug Handling"
            description="Identifies drugs not registered in the Korean formulary. Provides interaction data from international databases."
            iconColor="text-blue-600"
            delay={400}
          />
          <FeatureCard
            icon={AlertTriangle}
            title="Unknown Drug Fallback"
            description="Never returns blank. Allows manual active ingredient input for partial matching with an appropriate confidence flag."
            iconColor="text-slate-500"
            delay={500}
          />
        </div>
      </section>

      {/* ─── Drug Resolution Pipeline ───────────────────────────── */}
      <section className="bg-slate-50/60 border-y border-slate-100">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <div>
              <RevealSection>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Drug Pipeline</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
                  Six-case resolution
                </h2>
                <p className="text-sm text-slate-500 leading-relaxed mb-8">
                  Every drug input passes through a structured pipeline that classifies it before analysis — ensuring consistent results regardless of the drug's origin.
                </p>
              </RevealSection>
              <div className="space-y-4">
                <PipelineItem number="1" label="Korean Approved Veterinary Drugs" sublabel="Full interaction data with maximum confidence" delay={0} />
                <PipelineItem number="2" label="Human Drugs Used Off-Label" sublabel="Flagged with off-label advisory and adjusted confidence" delay={80} />
                <PipelineItem number="3" label="Foreign Drugs" sublabel="International formulary data with import advisory" delay={160} />
                <PipelineItem number="4" label="Unknown Drugs" sublabel="Manual active ingredient input for partial matching" delay={240} />
                <PipelineItem number="5" label="Multi-Drug Combinations" sublabel="Pairwise interaction matrix across all drugs" delay={320} />
                <PipelineItem number="6" label="Species-Specific Adjustments" sublabel="Dog vs. cat metabolism, dosing, and contraindications" delay={400} />
              </div>
            </div>

            {/* Visual: severity scale */}
            <RevealSection delay={200}>
              <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-5">Severity Classification</h3>
                <div className="space-y-3">
                  {[
                    { level: 'Critical', score: '100', color: 'bg-red-500', desc: 'Absolute contraindication — do not co-administer' },
                    { level: 'Moderate', score: '40–75', color: 'bg-amber-500', desc: 'Dose adjustment or monitoring required' },
                    { level: 'Minor', score: '15–39', color: 'bg-yellow-400', desc: 'Awareness — generally safe with monitoring' },
                    { level: 'None', score: '0', color: 'bg-emerald-500', desc: 'No known interaction detected' },
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
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Result Includes</h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      'Severity ranking',
                      'Active substances',
                      'Species notes',
                      'Off-label flags',
                      'Confidence score',
                      'Literature refs',
                    ].map((item, i) => (
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
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
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
                Interactive Demo
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
                See it in action — no login required
              </h2>
              <p className="text-sm text-white/60 max-w-md mx-auto mb-8 leading-relaxed">
                Choose a species and breed, review a pre-filled patient chart, adjust medications, and run a real DUR scan in under 60 seconds.
              </p>

              <button
                onClick={() => navigate('/demo')}
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-slate-900 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Launch Demo
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </RevealSection>
      </section>

      {/* ─── CTA ────────────────────────────────────────────────── */}
      <section className="border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
          <RevealSection>
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-3">
                Ready for your clinic?
              </h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
                Request full access to the complete DUR system with your entire drug database, patient records integration, and audit trails.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <button
                  onClick={() => setShowAccessModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all duration-200 shadow-sm"
                >
                  Request Full Access
                  <ArrowRight size={15} />
                </button>
                <button
                  onClick={() => navigate('/system')}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white text-slate-700 text-sm font-medium rounded-xl border border-slate-200 hover:border-slate-300 transition-all duration-200"
                >
                  <Lock size={13} />
                  Sign In
                </button>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-slate-100 bg-slate-50/50">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield size={13} className="text-slate-400" />
            <span className="text-xs text-slate-400 font-medium">VetDUR</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">Veterinary Drug Utilization Review</span>
          </div>
          <p className="text-xs text-slate-400">
            For veterinary professional use only. Not a substitute for clinical judgment.
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
