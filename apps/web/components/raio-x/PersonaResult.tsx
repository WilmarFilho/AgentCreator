import {
  Target, MessageSquare, Palette, UserCircle2, ArrowRight,
  Crosshair, Eye, Camera, LayoutGrid, Star, Sparkles, BookOpen
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
  const goal = goalLabels[persona.primary_goal] || goalLabels.authority;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
        <div className="w-16 h-16 bg-green-500/10 text-green-400 rounded-full flex items-center justify-center shrink-0">
          <UserCircle2 size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Persona Definida!</h2>
          <p className="text-green-400/90 font-medium">Análise profunda concluída com sucesso</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Row 1: Goal + Niche */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Primary Goal */}
          <div className="bg-zinc-950/40 p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-center gap-3 mb-4 text-brand">
              <Target size={22} />
              <h3 className="text-base font-bold">Objetivo Principal</h3>
            </div>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${goal.color} mb-3`}>
              <Crosshair size={16} />
              <span className="text-lg font-extrabold capitalize">{goal.label}</span>
            </div>
            <p className="text-slate-500 text-sm">{goal.description}</p>
          </div>

          {/* Content Niche */}
          <div className="bg-zinc-950/40 p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-center gap-3 mb-4 text-emerald-400">
              <BookOpen size={22} />
              <h3 className="text-base font-bold">Nicho de Conteúdo</h3>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">{persona.content_niche}</p>
          </div>
        </div>

        {/* Row 2: Tone of Voice */}
        <div className="bg-zinc-950/40 p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
          <div className="flex items-center gap-3 mb-4 text-blue-400">
            <MessageSquare size={22} />
            <h3 className="text-base font-bold">Tom de Voz</h3>
          </div>
          <div className="border-l-2 border-blue-500/30 pl-4">
            <p className="text-slate-300 leading-relaxed text-sm italic">{persona.tone_of_voice}</p>
          </div>
        </div>

        {/* Row 3: Psychological Profile */}
        <div className="bg-zinc-950/40 p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
          <div className="flex items-center gap-3 mb-4 text-amber-400">
            <UserCircle2 size={22} />
            <h3 className="text-base font-bold">Perfil Psicológico da Marca</h3>
          </div>
          <p className="text-slate-300 leading-relaxed text-sm">{persona.psychological_profile}</p>
        </div>

        {/* Row 4: Visual Preferences - structured */}
        {persona.visual_preferences && (
          <div className="bg-zinc-950/40 p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-center gap-3 mb-5 text-fuchsia-400">
              <Palette size={22} />
              <h3 className="text-base font-bold">Preferências Visuais</h3>
            </div>
            <VisualPreferencesCard prefs={persona.visual_preferences} />
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="flex justify-end pt-6 mt-6 border-t border-white/5">
        <Link
          href="/dashboard/studio"
          className="flex items-center gap-2 bg-slate-50 text-zinc-950 font-bold tracking-tight py-3.5 px-6 rounded-2xl hover:bg-slate-200 transition-colors active:scale-95"
        >
          <span>Avançar para Fábrica</span>
          <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}
