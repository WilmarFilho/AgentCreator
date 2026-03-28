'use client';

import { useState, useEffect } from 'react';
import { Loader2, Sparkles, TrendingUp, Lightbulb, PenTool, Check, ArrowRight, Save, Newspaper } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function StudioPage() {
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTrend, setActiveTrend] = useState<any>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Simulando busca de pautas mockadas
    setTimeout(() => {
      setTrends([
        {
          id: 'trend_1',
          topic_title: '3 Segredos para Vender SaaS em 2026',
          context_summary: 'A inteligência artificial está commoditizando softwares gerais. Ensine sua audiência a criar micro-SaaS focados.',
          news_source: 'TechCrunch: The rise of Micro-SaaS',
          relevance_score: 98
        },
        {
          id: 'trend_2',
          topic_title: 'O Fim dos Designers?',
          context_summary: 'Uma pauta controversa sobre como o AgentCreator substitui ferramentas clássicas de design e como se adaptar.',
          news_source: 'The Verge: AI taking over design tools',
          relevance_score: 92
        },
        {
          id: 'trend_3',
          topic_title: 'Design Premium Vende Mais',
          context_summary: 'Mostre a diferença psicológica entre uma UI feia e uma UI que usa glassmorphism e animações 60fps.',
          news_source: 'Nielsen Norman Group: Aesthetics & Usability',
          relevance_score: 87
        }
      ]);
      setLoading(false);
    }, 1500);
  }, []);

  const handleSelectTrend = (trend: any) => {
    setActiveTrend({
      ...trend,
      isGeneratingCopy: true,
      copy: null
    });
    setSaveSuccess(false);

    setTimeout(() => {
      setActiveTrend((curr: any) => ({
        ...curr,
        isGeneratingCopy: false,
        copy: `SLIDE 1: O segredo sujo da indústria que ninguém te conta... O mercado mudou.\n\nSLIDE 2: Ferramentas genéricas estão morrendo. A IA consegue criar um clone do seu sistema em minutos se ele não for focado.\n\nSLIDE 3: O que vende hoje? Micro-soluções ultra específicas para nichos ignorados por grandes empresas.\n\nSLIDE 4: E a chave principal não é apenas a funcionalidade. É o design. Design Premium não é luxo, é sobrevivência.\n\nSLIDE 5: Comece hoje a empacotar seu conhecimento num funil de alto valor visual.`
      }));
    }, 2000);
  };

  const handleSaveCopy = () => {
    if (!activeTrend?.copy) return;
    try {
      const existing = JSON.parse(localStorage.getItem('saved_copies') || '[]');
      existing.push({
        id: Date.now().toString(),
        title: activeTrend.topic_title,
        copy: activeTrend.copy,
        date: new Date().toISOString()
      });
      localStorage.setItem('saved_copies', JSON.stringify(existing));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendToFactory = () => {
    // Salva automaticamente e redireciona (ou passa por param)
    if (!activeTrend?.copy) return;
    localStorage.setItem('mock_copy_active', JSON.stringify({
      id: Date.now().toString(),
      title: activeTrend.topic_title,
      copy: activeTrend.copy
    }));
    router.push('/dashboard/factory');
  };

  return (
    <div className="max-w-screen-2xl mx-auto py-8">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-14 h-14 bg-brand/10 text-brand rounded-2xl flex items-center justify-center">
          <Lightbulb size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Estúdio de Cópias</h1>
          <p className="text-slate-400">Pautas baseadas em notícias em tempo real adaptadas para a sua Marca.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 opacity-70">
          <Loader2 className="w-12 h-12 text-brand animate-spin mb-4" />
          <p className="text-slate-300 font-medium">Lendo jornais, X(Twitter) e analisando o nicho...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LADO ESQUERDO: Lista de Pautas */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-50 border-b border-white/5 pb-4">1. Curadoria de Conteúdo</h2>
            {trends.map((trend) => (
              <div 
                key={trend.id} 
                onClick={() => handleSelectTrend(trend)}
                className={`bg-zinc-900/40 border ${activeTrend?.id === trend.id ? 'border-brand shadow-[0_0_15px_rgba(242,47,29,0.2)] bg-brand/5' : 'border-white/5 hover:border-white/10'} rounded-3xl p-6 relative flex flex-col group transition-all cursor-pointer`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="bg-white/5 text-slate-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-wider">
                    <TrendingUp size={12} className="text-green-400" /> Score: {trend.relevance_score}
                  </span>
                  {activeTrend?.id === trend.id ? (
                    <Check size={18} className="text-brand" />
                  ) : (
                    <Sparkles size={16} className="text-yellow-500/80" />
                  )}
                </div>

                <h3 className="text-xl font-bold text-slate-50 mb-3">{trend.topic_title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  {trend.context_summary}
                </p>
                <div className="mt-auto pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-slate-500">
                  <Newspaper size={14} className="text-blue-400" />
                  Baseado em: <span className="text-slate-300 font-medium">{trend.news_source}</span>
                </div>
              </div>
            ))}
          </div>

          {/* LADO DIREITO: Editor de Copy */}
          <div className="space-y-6">
             <h2 className="text-xl font-bold text-slate-50 mb-6 border-b border-white/5 pb-4">2. O Roteiro (Copy)</h2>
             {!activeTrend ? (
                <div className="h-48 border border-dashed border-white/10 rounded-3xl flex items-center justify-center text-slate-500 bg-zinc-900/20">
                   Selecione um tema ao lado para gerar a copy.
                </div>
             ) : activeTrend.isGeneratingCopy ? (
                <div className="h-64 border border-white/5 rounded-3xl flex flex-col items-center justify-center bg-zinc-900/40 animate-pulse">
                   <PenTool size={32} className="text-brand mb-4 animate-bounce" />
                   <p className="text-slate-300">O copywriter IA está rascunhando até 10 slides...</p>
                </div>
             ) : (
                <div className="bg-zinc-900/60 border border-white/10 p-6 rounded-3xl flex flex-col h-[600px] relative">
                   <h3 className="font-bold text-lg mb-2 text-white">Roteiro Otimizado</h3>
                   <p className="text-xs text-slate-400 mb-4">Ajuste qualquer vírgula antes de enviar para o Canva da IA.</p>
                   
                   <textarea 
                     className="flex-1 w-full bg-black/40 border border-white/5 rounded-2xl p-5 text-slate-300 text-sm font-medium leading-loose focus:outline-none focus:ring-1 focus:ring-brand resize-none custom-scrollbar"
                     defaultValue={activeTrend.copy}
                     onChange={(e) => setActiveTrend({...activeTrend, copy: e.target.value})}
                   />

                   <div className="grid grid-cols-2 gap-4 mt-6">
                     <button 
                       onClick={handleSaveCopy}
                       disabled={saveSuccess}
                       className="flex items-center justify-center gap-2 bg-zinc-800 text-white font-bold py-3.5 rounded-xl hover:bg-zinc-700 transition-all border border-white/10"
                     >
                       {saveSuccess ? <Check size={18} className="text-green-400" /> : <Save size={18} />}
                       <span>{saveSuccess ? 'Salvo no Acervo!' : 'Salvar Copy'}</span>
                     </button>
                     <button 
                       onClick={handleSendToFactory}
                       className="flex items-center justify-center gap-2 bg-brand text-white font-bold py-3.5 rounded-xl hover:bg-brand/90 transition-all shadow-[0_0_20px_rgba(242,47,29,0.3)] hover:shadow-[0_0_30px_rgba(242,47,29,0.5)]"
                     >
                       <span>Gerar Arte</span>
                       <ArrowRight size={18} />
                     </button>
                   </div>
                </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
