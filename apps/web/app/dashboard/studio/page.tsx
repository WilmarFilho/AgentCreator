'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ExternalLink, Lightbulb, Loader2, Newspaper, PenTool, Save, Sparkles, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Trend = {
  id: string;
  topic_title: string;
  context_summary: string;
  source?: string;
  source_url?: string;
  published_at?: string;
  relevance_score: number;
};

type Slide = {
  order: number;
  copy_text: string;
  ai_image_prompt?: string;
};

type CopyPreview = {
  main_caption: string;
  slides: Slide[];
};

export default function StudioPage() {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [activeTrend, setActiveTrend] = useState<Trend | null>(null);
  const [preview, setPreview] = useState<CopyPreview | null>(null);
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [competitorStatus, setCompetitorStatus] = useState<string>('idle');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) {
        return;
      }

      setProfileId(session?.user?.id || null);
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!mounted) {
        return;
      }

      setProfileId(session?.user?.id || null);
      setLoadingSession(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!profileId) {
      setTrends([]);
      return;
    }

    let mounted = true;

    async function fetchTrends() {
      setLoadingTrends(true);
      setError(null);

      try {
        const response = await fetch(`${API_URL}/api/studio/trends?profileId=${profileId}`);

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || 'Falha ao buscar pautas');
        }

        const data = await response.json();

        if (mounted) {
          setTrends(data);
        }
      } catch (fetchError: any) {
        if (mounted) {
          setError(fetchError.message || 'Não foi possível carregar as pautas.');
        }
      } finally {
        if (mounted) {
          setLoadingTrends(false);
        }
      }
    }

    async function fetchObjectives() {
      try {
        const { data } = await supabase.from('creator_objectives').select('competitor_analysis_status').eq('profile_id', profileId).single();
        if (mounted && data) {
          setCompetitorStatus(data.competitor_analysis_status || 'idle');
        }
      } catch (e) {
        console.error(e);
      }
    }

    fetchTrends();
    fetchObjectives();

    const channel = supabase
      .channel('creator_objectives_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'creator_objectives',
        filter: `profile_id=eq.${profileId}`,
      }, (payload: any) => {
        if (mounted) {
          setCompetitorStatus(payload.new.competitor_analysis_status || 'idle');
        }
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [profileId]);

  const compiledCopy = useMemo(() => {
    if (!activeTrend || !preview?.slides?.length) {
      return null;
    }

    return {
      id: activeTrend.id,
      title: activeTrend.topic_title,
      main_caption: preview.main_caption,
      slides: preview.slides,
      copy: preview.slides
        .map((slide) => `SLIDE ${slide.order}: ${slide.copy_text}`)
        .join('\n\n'),
      source: activeTrend.source,
      date: new Date().toISOString(),
    };
  }, [activeTrend, preview]);

  const handleSelectTrend = async (trend: Trend) => {
    if (!profileId) {
      return;
    }

    if (competitorStatus === 'running') {
      setError('Ainda estamos mapeando e analisando o seu concorrente atual. Aguarde alguns instantes até a conclusão para gerar uma rota mais precisa.');
      return;
    }

    setActiveTrend(trend);
    setPreview(null);
    setSaveSuccess(false);
    setIsGeneratingCopy(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/studio/copy-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, topicId: trend.id }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Falha ao gerar copy');
      }

      const data = await response.json();
      setPreview({
        main_caption: data.main_caption || '',
        slides: Array.isArray(data.slides) ? data.slides : [],
      });
    } catch (generateError: any) {
      setError(generateError.message || 'Não foi possível gerar a copy.');
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  const persistCopy = () => {
    if (!compiledCopy) {
      return null;
    }

    const existing = JSON.parse(localStorage.getItem('saved_copies') || '[]');
    const filtered = existing.filter((item: any) => item.id !== compiledCopy.id);
    const nextCopies = [compiledCopy, ...filtered];
    localStorage.setItem('saved_copies', JSON.stringify(nextCopies));
    return compiledCopy;
  };

  const handleSaveCopy = () => {
    if (!compiledCopy) {
      return;
    }

    persistCopy();
    setSaveSuccess(true);
    window.setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSendToFactory = () => {
    const persisted = persistCopy();

    if (!persisted) {
      return;
    }

    localStorage.setItem('mock_copy_active', JSON.stringify(persisted));
    router.push('/dashboard/factory');
  };

  const updateSlideText = (order: number, value: string) => {
    setPreview((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        slides: current.slides.map((slide) =>
          slide.order === order ? { ...slide, copy_text: value } : slide,
        ),
      };
    });
  };

  const updateCaption = (value: string) => {
    setPreview((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        main_caption: value,
      };
    });
  };

  const loading = loadingSession || loadingTrends;

  return (
    <div className="max-w-screen-2xl mx-auto py-8">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-14 h-14 bg-brand/10 text-brand rounded-2xl flex items-center justify-center">
          <Lightbulb size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Estúdio de Cópias</h1>
          <p className="text-slate-400">Pautas frescas dos últimos 3 dias, cruzadas com a persona do perfil e cacheadas por 24h.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 opacity-70">
          <Loader2 className="w-12 h-12 text-brand animate-spin mb-4" />
          <p className="text-slate-300 font-medium">Lendo notícias recentes e cruzando com o nicho do perfil...</p>
        </div>
      ) : !profileId ? (
        <div className="h-48 border border-dashed border-white/10 rounded-3xl flex items-center justify-center text-slate-500 bg-zinc-900/20">
          Faça login para carregar o estúdio.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-50 border-b border-white/5 pb-4">1. Curadoria de Conteúdo</h2>
            {trends.length === 0 ? (
              <div className="h-48 border border-dashed border-white/10 rounded-3xl flex items-center justify-center text-slate-500 bg-zinc-900/20 text-center px-6">
                Nenhuma pauta foi encontrada ainda. Execute o Raio-X e tente novamente em alguns instantes.
              </div>
            ) : (
              trends.map((trend) => (
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
                  <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <Newspaper size={14} className="text-blue-400" />
                      <span className="text-slate-300 font-medium">{trend.source || 'Google News'}</span>
                    </div>
                    {trend.source_url && (
                      <a
                        href={trend.source_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-white"
                      >
                        Fonte <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-50 mb-6 border-b border-white/5 pb-4">2. O Roteiro (Copy)</h2>
            {!activeTrend ? (
              <div className="h-48 border border-dashed border-white/10 rounded-3xl flex items-center justify-center text-slate-500 bg-zinc-900/20">
                Selecione um tema ao lado para gerar a copy.
              </div>
            ) : isGeneratingCopy ? (
              <div className="h-64 border border-white/5 rounded-3xl flex flex-col items-center justify-center bg-zinc-900/40 animate-pulse">
                <PenTool size={32} className="text-brand mb-4 animate-bounce" />
                <p className="text-slate-300">O copywriter IA está rascunhando os slides desse tema...</p>
              </div>
            ) : preview ? (
              <div className="bg-zinc-900/60 border border-white/10 p-6 rounded-3xl flex flex-col gap-5 h-[720px] overflow-y-auto custom-scrollbar">
                <div>
                  <h3 className="font-bold text-lg mb-2 text-white">Legenda principal</h3>
                  <textarea
                    className="w-full min-h-28 bg-black/40 border border-white/5 rounded-2xl p-4 text-slate-300 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                    value={preview.main_caption}
                    onChange={(event) => updateCaption(event.target.value)}
                  />
                </div>

                <div className="space-y-4">
                  {preview.slides.map((slide) => (
                    <div key={slide.order} className="rounded-2xl border border-white/5 bg-black/20 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand">
                          Slide {slide.order}
                        </span>
                      </div>
                      <textarea
                        className="w-full min-h-24 bg-transparent text-slate-200 text-sm leading-relaxed focus:outline-none resize-none"
                        value={slide.copy_text}
                        onChange={(event) => updateSlideText(slide.order, event.target.value)}
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-auto">
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
            ) : (
              <div className="h-48 border border-dashed border-white/10 rounded-3xl flex items-center justify-center text-slate-500 bg-zinc-900/20">
                Selecione um tema para montar o roteiro completo.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
