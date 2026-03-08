import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, Loader2, Database, Beaker, BookOpen, Dna, Globe, ShieldCheck } from 'lucide-react';
import { NuvovetLogo } from './NuvovetLogo';
import { MolecularBackground } from './MolecularBackground';
import { useI18n } from '../i18n';

export function AnalysisScreen({ onComplete, drugCount, species }) {
  const { t, lang } = useI18n();
  const [completedSteps, setCompletedSteps] = useState([]);
  const [activeStep, setActiveStep] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const STEPS = [
    { id: 'resolve',    label: t.analysis.step1, detail: t.analysis.step1Sub, icon: Database,    duration: 350 },
    { id: 'korean_db',  label: t.analysis.step2, detail: t.analysis.step2Sub, icon: Globe,       duration: 450 },
    { id: 'cyp',        label: t.analysis.step3, detail: t.analysis.step3Sub, icon: Dna,         duration: 400 },
    { id: 'ddi',        label: t.analysis.step4, detail: t.analysis.step4Sub, icon: ShieldCheck,  duration: 500 },
    { id: 'species',    label: t.analysis.step5, detail: t.analysis.step5Sub, icon: Beaker,      duration: 350 },
    { id: 'literature', label: t.analysis.step6, detail: t.analysis.step6Sub, icon: BookOpen,    duration: 400 },
  ];
  // Total: ~2.45s + 200ms initial + 250ms final = ~2.9s (down from ~4.8s)

  useEffect(() => {
    let timer;
    const steps = STEPS;

    const runStep = (index) => {
      if (index >= steps.length) {
        timer = setTimeout(() => onCompleteRef.current(), 250);
        return;
      }
      setActiveStep(index);
      timer = setTimeout(() => {
        setCompletedSteps(prev => [...prev, steps[index].id]);
        runStep(index + 1);
      }, steps[index].duration);
    };

    timer = setTimeout(() => runStep(0), 200);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const speciesLabel = species === 'dog'
    ? (lang === 'ko' ? '개' : 'canine')
    : (lang === 'ko' ? '고양이' : 'feline');

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center">
      <MolecularBackground />

      <div className="relative z-10 max-w-sm w-full px-6 py-12">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <div className="relative">
            <NuvovetLogo size={96} className="" />
            <div className="absolute inset-0 animate-ping opacity-20">
              <NuvovetLogo size={96} className="" />
            </div>
          </div>
        </div>

        <h2 className="text-center typo-page-title mb-1">
          {t.analysis.analyzingPrescription}
        </h2>
        <p className="text-center typo-label mb-8">
          {lang === 'ko'
            ? `${speciesLabel} 환자 — ${drugCount}종 약물 검사 중`
            : `Screening ${drugCount} drug${drugCount !== 1 ? 's' : ''} for ${speciesLabel} patient`
          }
        </p>

        {/* Steps */}
        <div className="space-y-2 bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 shadow-sm">
          {STEPS.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id);
            const isActive = activeStep === index && !isCompleted;
            const isPending = index > activeStep;
            const Icon = step.icon;

            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 px-3 py-2 rounded-lg transition-all duration-300 ${
                  isActive ? 'bg-slate-50' : ''
                } ${isPending ? 'opacity-40' : 'opacity-100'}`}
              >
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <CheckCircle size={16} className="text-emerald-500" />
                  ) : isActive ? (
                    <Loader2 size={16} className="text-slate-600 animate-spin" />
                  ) : (
                    <Icon size={16} className="text-slate-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-[13px] leading-tight ${isCompleted ? 'text-slate-600' : isActive ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                    {step.label}
                  </p>
                  {isActive && (
                    <p className="text-[11px] text-slate-400 mt-0.5 animate-fade-in truncate">
                      {step.detail}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-4 w-full h-1 bg-slate-200/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-slate-900/60 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${((completedSteps.length) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
