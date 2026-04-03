import {
  Target, MessageSquare, Palette, UserCircle2, ArrowRight,
  Crosshair, Eye, Camera, LayoutGrid, Star, Sparkles, BookOpen, Brain,
  TrendingUp, Users, CheckCircle2, AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

const goalLabels: Record<string, { label: string; color: string; description: string }> = {
  sales: { label: 'Vendas', color: 'text-green-400 bg-green-500/10 border-green-500/20', description: 'Foco em conversão e geração de receita' },
  authority: { label: 'Autoridade', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', description: 'Posicionamento como referência no nicho' },
  growth: { label: 'Crescimento', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', description: 'Expansão de audiência e alcance' },
};

function VisualPreferencesCard({ prefs }: { prefs: any }) {
  if (!prefs || typeof prefs !== 'object') return null;

  const items: { icon: React.ReactNode; label: string; value: string; color: string }[] = [];

  if (prefs.colors) {
    items.push({ icon: <Palette size={16} />, label: 'Cores', value: prefs.colors, color: 'text-fuchsia-400' });
  }
  if (prefs.style) {
    items.push({ icon: <Eye size={16} />, label: 'Estilo', value: prefs.style, color: 'text-cyan-400' });
  }
  if (prefs.photo_quality) {
    items.push({ icon: <Camera size={16} />, label: 'Qualidade Visual', value: prefs.photo_quality, color: 'text-amber-400' });
  }
  if (prefs.content_formats) {
    items.push({ icon: <LayoutGrid size={16} />, label: 'Formatos', value: prefs.content_formats, color: 'text-emerald-400' });
  }
  if (prefs.visual_identity_score) {
    items.push({ icon: <Star size={16} />, label: 'Identidade Visual', value: `${prefs.visual_identity_score}/10`, color: 'text-yellow-400' });
  }

  // Fallback: render any unknown keys as well
  const knownKeys = ['colors', 'style', 'photo_quality', 'content_formats', 'visual_identity_score'];
  Object.entries(prefs).forEach(([key, value]) => {
    if (!knownKeys.includes(key) && typeof value === 'string') {
      items.push({
        icon: <Sparkles size={16} />,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        value: value,
        color: 'text-slate-400',
      });
    }
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((item, idx) => (
        <div key={idx} className="bg-black/20 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
          <div className={`flex items-center gap-2 mb-2 ${item.color}`}>
            {item.icon}
            <span className="text-xs font-semibold uppercase tracking-wider">{item.label}</span>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">{item.value}</p>
        </div>
      ))}
    </div>
  );
}



export default function PersonaResult({ persona }: { persona: any }) {
  // Formatação do fator de viralização (0-10)
  const viralScore = (persona.fator_viralizacao || 0).toFixed(1);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 space-y-8">

      {/* HEADER COM GRADIENTE NEON */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-8">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-violet-600 rounded-full blur opacity-40 animate-pulse"></div>
            <div className="relative w-20 h-20 bg-zinc-950 border border-white/10 text-cyan-400 rounded-full flex items-center justify-center shrink-0">
              <UserCircle2 size={40} />
            </div>
          </div>
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter">
              Brand <span className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">Persona</span>
            </h2>
            <p className="text-slate-400 font-medium flex items-center gap-2">
              <Sparkles size={16} className="text-violet-400" />
              Análise estratégica de elite concluída
            </p>
          </div>
        </div>

        {/* MÉTRICA DE VIRALIZAÇÃO */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 rounded-3xl flex items-center gap-4 min-w-[200px]">
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-2xl">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Viral Factor</p>
            <p className="text-2xl font-black text-white">{viralScore}<span className="text-sm text-slate-500">/10</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* COLUNA DA ESQUERDA: IDENTIDADE CORE */}
        <div className="lg:col-span-1 space-y-6">
          {/* Posicionamento */}
          <div className="group bg-zinc-900/40 backdrop-blur-md p-6 rounded-3xl border border-white/5 hover:border-cyan-500/30 transition-all duration-500">
            <div className="flex items-center gap-3 mb-4 text-cyan-400">
              <Target size={20} />
              <h3 className="text-sm font-bold uppercase tracking-wider">Posicionamento</h3>
            </div>
            <p className="text-2xl font-extrabold text-white leading-tight">
              {persona.posicionamento}
            </p>
          </div>

          {/* Nicho e Subnichos */}
          <div className="bg-zinc-900/40 backdrop-blur-md p-6 rounded-3xl border border-white/5">
            <div className="flex items-center gap-3 mb-4 text-violet-400">
              <BookOpen size={20} />
              <h3 className="text-sm font-bold uppercase tracking-wider">Nicho Principal</h3>
            </div>
            <p className="text-lg font-bold text-slate-200 mb-4">{persona.nicho_principal}</p>
            <div className="flex flex-wrap gap-2">
              {persona.subnichos?.map((sub: string) => (
                <span key={sub} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-medium text-slate-400">
                  {sub}
                </span>
              ))}
            </div>
          </div>

          {/* Público Alvo */}
          <div className="bg-zinc-900/40 backdrop-blur-md p-6 rounded-3xl border border-white/5">
            <div className="flex items-center gap-3 mb-4 text-emerald-400">
              <Users size={20} />
              <h3 className="text-sm font-bold uppercase tracking-wider">Público Alvo</h3>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">{persona.publico_alvo}</p>
          </div>
        </div>

        {/* COLUNA DA DIREITA: ANÁLISE PROFUNDA */}
        <div className="lg:col-span-2 space-y-6">

          {/* Resumo Psicológico - O Card Principal */}
          <div className="relative overflow-hidden bg-zinc-900/60 backdrop-blur-md p-8 rounded-3xl border border-white/10 shadow-2xl">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Brain size={120} />
            </div>
            <div className="flex items-center gap-3 mb-6 text-amber-400">
              <Brain size={24} />
              <h3 className="text-xl font-black">Perfil Psicológico & Estratégia</h3>
            </div>
            <p className="text-slate-300 leading-relaxed text-lg font-medium whitespace-pre-wrap">
              {persona.resumo_psicologico}
            </p>
          </div>

          {/* Grid de Pontos Fortes e Fracos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pontos Fortes */}
            <div className="bg-emerald-500/5 p-6 rounded-3xl border border-emerald-500/10">
              <div className="flex items-center gap-3 mb-4 text-emerald-400 font-bold uppercase text-xs tracking-widest">
                <CheckCircle2 size={18} />
                Vantagens Competitivas
              </div>
              <ul className="space-y-3">
                {persona.pontos_fortes?.map((p: string, i: number) => (
                  <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pontos Fracos */}
            <div className="bg-rose-500/5 p-6 rounded-3xl border border-rose-500/10">
              <div className="flex items-center gap-3 mb-4 text-rose-400 font-bold uppercase text-xs tracking-widest">
                <AlertCircle size={18} />
                Gaps de Retenção
              </div>
              <ul className="space-y-3">
                {persona.pontos_fracos?.map((p: string, i: number) => (
                  <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1.5 shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* CTA FOOTER */}
      <div className="flex items-center justify-between pt-10 border-t border-white/5">
        <div className="hidden md:block">
          <p className="text-slate-500 text-sm">Pronto para transformar essa estratégia em posts reais?</p>
        </div>
        <Link
          href="/dashboard/studio"
          className="group relative flex items-center gap-3 bg-white text-zinc-950 font-black tracking-tight py-4 px-10 rounded-2xl transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-cyan-500/20"
        >
          <span>Avançar para Fábrica</span>
          <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );

}
