import React from 'react';
import { Check, Hash, Calendar, Clock, BookOpen, Loader2, Printer } from 'lucide-react';
import { Pill } from 'lucide-react';
import { useI18n } from '../../i18n';

export const PrescriptionSummary = ({
  prescription,
  ownerInstructions,
  isGenerating,
  onGenerateSummary,
  onFinish
}) => {
  const { t } = useI18n();
  return (
    <div className="max-w-3xl mx-auto py-4">
      <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-200 border-t-[12px] border-t-indigo-600">
        <div className="p-10 border-b border-slate-100 flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-black text-slate-900 leading-none mb-2">{t.prescription.title}</h2>
            <div className="flex items-center gap-4 text-slate-400">
              <div className="flex items-center gap-1.5">
                <Hash size={12} />
                <span className="text-[10px] font-black uppercase tracking-tighter">
                  RX-{Date.now().toString().slice(-8)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar size={12} />
                <span className="text-[10px] font-black uppercase tracking-tighter">
                  {new Date().toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={12} />
                <span className="text-[10px] font-black uppercase tracking-tighter">{t.prescription.verified}</span>
              </div>
            </div>
          </div>
          <div className="w-16 h-16 bg-green-50 text-green-600 rounded-3xl flex items-center justify-center shadow-inner">
            <Check size={32} />
          </div>
        </div>

        <div className="p-10 space-y-10">
          <section>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
              {t.prescription.medicationList}
            </h4>
            <div className="space-y-3">
              {prescription.map(p => (
                <div
                  key={p.id}
                  className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 flex justify-between items-center"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-100 text-indigo-600">
                      <Pill size={14} />
                    </div>
                    <span className="font-black text-sm text-slate-800">{p.name}</span>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 bg-white px-3 py-1.5 rounded-lg border border-slate-100 uppercase">
                    {p.dosage}{p.unit} • {p.freq}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <BookOpen size={16} /> {t.prescription.ownerInstructions}
                </h4>
                {!ownerInstructions && !isGenerating && (
                  <button
                    onClick={onGenerateSummary}
                    className="text-[9px] font-black uppercase text-white bg-indigo-600 px-4 py-2 rounded-xl shadow-lg"
                  >
                    {t.prescription.generateAI}
                  </button>
                )}
              </div>

              {isGenerating ? (
                <div className="py-6 flex items-center gap-4 text-slate-400">
                  <Loader2 size={24} className="animate-spin" />
                  <span className="text-sm font-black uppercase tracking-widest">{t.prescription.compiling}</span>
                </div>
              ) : (
                ownerInstructions && (
                  <div className="animate-in fade-in duration-500">
                    <p className="text-lg font-bold leading-tight mb-8">"{ownerInstructions.text}"</p>
                    <div className="grid grid-cols-1 gap-3">
                      {ownerInstructions.bullets.map((b, i) => (
                        <div key={i} className="text-[11px] font-bold text-slate-300 flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                          <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0" />
                          {b}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </section>

          <div className="flex gap-4">
            <button className="flex-1 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-[11px] uppercase flex items-center justify-center gap-3 shadow-xl hover:bg-indigo-700 transition-all">
              <Printer size={18} /> {t.prescription.printLabels}
            </button>
            <button
              onClick={onFinish}
              className="px-8 bg-slate-100 text-slate-400 rounded-[1.5rem] font-black text-[11px] uppercase"
            >
              {t.prescription.finishSession}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
