import { Target, MessageSquare, Palette, UserCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function PersonaResult({ persona }: { persona: any }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
        <div className="w-16 h-16 bg-green-500/10 text-green-400 rounded-full flex items-center justify-center">
          <UserCircle2 size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Persona Definida!</h2>
          <p className="text-green-400/90 font-medium">Extração de IA concluída com sucesso</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
        <div className="bg-zinc-950/40 p-6 rounded-2xl border border-white/5 group hover:border-white/10 transition-colors">
          <div className="flex items-center gap-3 mb-4 text-brand">
            <Target size={24} />
            <h3 className="text-lg font-bold">Objetivo Principal</h3>
          </div>
          <p className="text-slate-50 text-xl capitalize font-bold">{persona.primary_goal}</p>
          <p className="text-slate-500 text-sm mt-1">Foco prioritário</p>
        </div>

        <div className="bg-zinc-950/40 p-6 rounded-2xl border border-white/5 group hover:border-white/10 transition-colors">
          <div className="flex items-center gap-3 mb-4 text-blue-400">
            <MessageSquare size={24} />
            <h3 className="text-lg font-bold">Tom de Voz</h3>
          </div>
          <p className="text-slate-300 leading-relaxed italic border-l-2 border-blue-500/30 pl-3">
            "{persona.tone_of_voice}"
          </p>
        </div>

        <div className="bg-zinc-950/40 p-6 rounded-2xl border border-white/5 md:col-span-2 group hover:border-white/10 transition-colors">
          <div className="flex flex-col mb-4 gap-2">
            <div className="flex items-center gap-3 text-amber-400">
              <UserCircle2 size={24} />
              <h3 className="text-lg font-bold">Resumo Psicológico</h3>
            </div>
            <p className="text-slate-300 leading-relaxed mt-2">
              {persona.psychological_profile}
            </p>
          </div>
        </div>

        {persona.visual_preferences && (
          <div className="bg-zinc-950/40 p-6 rounded-2xl border border-white/5 md:col-span-2 group hover:border-white/10 transition-colors">
             <div className="flex items-center gap-3 mb-4 text-fuchsia-400">
                <Palette size={24} />
                <h3 className="text-lg font-bold">Preferências Visuais</h3>
             </div>
             <div className="text-slate-300 font-mono text-sm bg-black/20 p-4 rounded-xl">
               {JSON.stringify(persona.visual_preferences, null, 2)}
             </div>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-white/5">
         <Link href="/dashboard/studio" className="flex items-center gap-2 bg-slate-50 text-zinc-950 font-bold tracking-tight py-3.5 px-6 rounded-2xl hover:bg-slate-200 transition-colors active:scale-95">
            <span>Avançar para Fábrica</span>
            <ArrowRight size={18} />
         </Link>
      </div>
    </div>
  );
}
