'use client';

import { useState, useEffect, Suspense } from 'react';
import InstagramConnectForm from '@/components/raio-x/InstagramConnectForm';
import PersonaResult from '../../../components/raio-x/PersonaResult';
import { Loader2, Image, Film, Type, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

type AccountInfo = { igUserId: string; username: string; pageName: string; };

const mediaTypeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  IMAGE: { icon: <Image className="w-3.5 h-3.5" />, label: 'Foto', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  VIDEO: { icon: <Film className="w-3.5 h-3.5" />, label: 'Vídeo', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  CAROUSEL_ALBUM: { icon: <Sparkles className="w-3.5 h-3.5" />, label: 'Carrossel', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
};

function RaioXContent() {
  const [status, setStatus] = useState<'IDLE' | 'SELECT_ACCOUNT' | 'ANALYSING' | 'DONE'>('IDLE');
  const [persona, setPersona] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [availableAccounts, setAvailableAccounts] = useState<AccountInfo[]>([]);
  const [analyzedPosts, setAnalyzedPosts] = useState<any[]>([]);

  const fetchPosts = async (uid: string) => {
    try {
      const { data, error } = await supabase.from('post_metrics')
        .select('*')
        .eq('profile_id', uid)
        .order('posted_at', { ascending: false })
        .limit(30);
      if (data && !error) {
        setAnalyzedPosts(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    console.log("RaioXContent mounted, checking session...");

    async function checkExistingPersona(uid: string) {
      if (!mounted) return;
      try {
        console.log("Checking existing persona for user:", uid);
        const { data, error } = await supabase.from('brand_personas')
          .select('*')
          .eq('profile_id', uid)
          .single();

        if (mounted) {
          if (data && !error) {
            console.log("Persona encontrada:", data.id);
            setPersona(data);
            setStatus('DONE');
            fetchPosts(uid);
          } else {
            console.log("Nenhuma persona encontrada ou erro:", error?.message);
            if (searchParams?.get('step') === 'select_account' && searchParams?.get('token')) {
              console.log("Detectado ?step=select_account na URL, entrando em modo SELECT_ACCOUNT");
              setStatus('SELECT_ACCOUNT');
              fetchAccounts(searchParams.get('token') as string);
            } else if (searchParams?.get('success') === 'true') {
              console.log("Detectado ??success=true na URL, entrando em modo ANALYSING");
              setStatus('ANALYSING');
              router.replace('/dashboard/raio-x', { scroll: false });
            }
          }
          setLoadingUser(false);
        }
      } catch (err) {
        console.error("Erro ao verificar persona:", err);
        if (mounted) setLoadingUser(false);
      }
    }

    async function fetchAccounts(token: string) {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/raio-x/accounts?token=${token}`);
        if (!res.ok) throw new Error('Falha ao buscar contas');
        const data = await res.json();
        if (mounted) setAvailableAccounts(data);
      } catch (err) {
        console.error("Erro ao buscar contas:", err);
        if (mounted) {
          alert('Erro ao buscar contas do Instagram. Tente conectar novamente.');
          setStatus('IDLE');
        }
      }
    }

    // 1. Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        if (session?.user) {
          console.log("Sessão inicial encontrada:", session.user.id);
          setUserId(session.user.id);
          checkExistingPersona(session.user.id);
        } else {
          console.warn("Nenhuma sessão inicial encontrada.");
          setLoadingUser(false);
        }
      }
    });

    // 2. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state change event:", event, session?.user?.id);
      if (mounted && session?.user) {
        setUserId(session.user.id);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [searchParams, router]);

  useEffect(() => {
    if (status === 'ANALYSING' && userId) {
      console.log("Iniciando Realtime listener para brand_personas...");
      const channel = supabase
        .channel('brand_personas_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'brand_personas',
            filter: `profile_id=eq.${userId}`,
          },
          (payload: any) => {
            console.log("Nova persona detectada via Realtime!", payload.new);
            setPersona(payload.new);
            setStatus('DONE');
            fetchPosts(userId);
          }
        )
        .subscribe((status) => {
          console.log("Realtime subscription status:", status);
        });

      return () => {
        console.log("Limpando Realtime listener.");
        supabase.removeChannel(channel);
      };
    }
  }, [status, userId]);

  const handleConnect = () => {
    console.log("Botão de conectar clicado. userId atual:", userId);
    if (!userId) {
      alert("Aguardando carregamento da sessão... Verifique se você está logado.");
      return;
    }

    setStatus('ANALYSING');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const finalUrl = `${apiUrl}/api/raio-x/oauth/facebook?profileId=${userId}`;
    console.log("Redirecionando para:", finalUrl);
    window.location.href = finalUrl;
  };

  const handleAccountSelect = async (account: AccountInfo) => {
    setStatus('ANALYSING');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = searchParams?.get('token');

      const res = await fetch(`${apiUrl}/api/raio-x/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: userId,
          handle: account.username,
          igUserId: account.igUserId,
          accessToken: token
        })
      });

      if (!res.ok) throw new Error('Falha ao iniciar análise');

      router.replace('/dashboard/raio-x', { scroll: false });
    } catch (e) {
      console.error(e);
      alert('Erro ao iniciar análise');
      setStatus('IDLE');
    }
  };

  // Count content types for stats
  const postStats = {
    images: analyzedPosts.filter(p => p.media_type === 'IMAGE').length,
    videos: analyzedPosts.filter(p => p.media_type === 'VIDEO').length,
    carousels: analyzedPosts.filter(p => p.media_type === 'CAROUSEL_ALBUM').length,
  };

  if (loadingUser) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
        <p className="text-slate-400">Verificando sessão...</p>
      </div>
    );
  }

  return (
    <div className="max-w-screen-2xl mx-auto py-6">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2 drop-shadow-md">
          Raio-X do Criador
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          Análise profunda do seu perfil. Conecte para que nossa IA analise legendas, imagens, carrosséis e vídeos para desenhar sua Brand Persona completa.
        </p>
      </div>

      <div className="bg-zinc-900/40 border border-white/5 rounded-3xl shadow-2xl p-8 relative overflow-hidden backdrop-blur-2xl">
        {status === 'IDLE' && (
          <InstagramConnectForm onConnect={handleConnect} />
        )}

        {status === 'SELECT_ACCOUNT' && (
          <div className="flex flex-col items-center justify-center py-10">
            <h3 className="text-2xl font-bold text-white mb-6">Selecione a conta do Instagram</h3>
            {availableAccounts.length === 0 ? (
              <Loader2 className="w-10 h-10 text-brand animate-spin" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                {availableAccounts.map(acc => (
                  <button
                    key={acc.igUserId}
                    onClick={() => handleAccountSelect(acc)}
                    className="p-6 bg-zinc-800/50 hover:bg-zinc-700/80 border border-white/10 rounded-2xl flex flex-col items-start transition-all duration-200"
                  >
                    <span className="text-lg font-bold text-white tracking-wide">@{acc.username}</span>
                    <span className="text-sm text-slate-400 mt-1">Página associada: {acc.pageName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {status === 'ANALYSING' && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-16 h-16 text-brand animate-spin mb-6 drop-shadow-[0_0_15px_rgba(242,47,29,0.5)]" />
            <h3 className="text-2xl font-bold text-white mb-4">Análise Profunda em andamento...</h3>
            <div className="text-slate-400 text-center max-w-lg space-y-3">
              <p>Nossos agentes de IA estão trabalhando em múltiplas frentes:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <div className="bg-zinc-800/60 rounded-xl p-4 border border-white/5 flex flex-col items-center gap-2">
                  <Type className="w-6 h-6 text-emerald-400" />
                  <span className="text-xs text-slate-300">Analisando legendas</span>
                </div>
                <div className="bg-zinc-800/60 rounded-xl p-4 border border-white/5 flex flex-col items-center gap-2">
                  <Image className="w-6 h-6 text-blue-400" />
                  <span className="text-xs text-slate-300">Analisando imagens</span>
                </div>
                <div className="bg-zinc-800/60 rounded-xl p-4 border border-white/5 flex flex-col items-center gap-2">
                  <Film className="w-6 h-6 text-purple-400" />
                  <span className="text-xs text-slate-300">Transcrevendo vídeos</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-4">
                Isso pode levar de 2 a 5 minutos dependendo da quantidade de conteúdo.
              </p>
            </div>
          </div>
        )}

        {status === 'DONE' && persona && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <PersonaResult persona={persona} />
            
            {analyzedPosts.length > 0 && (
              <div className="bg-zinc-900/60 border border-white/5 rounded-3xl p-8 backdrop-blur-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                  <h3 className="text-2xl font-bold text-white">Posts Analisados</h3>
                  <div className="flex gap-3">
                    {postStats.images > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20">
                        <Image className="w-3.5 h-3.5" />
                        {postStats.images} {postStats.images === 1 ? 'Foto' : 'Fotos'}
                      </span>
                    )}
                    {postStats.carousels > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
                        <Sparkles className="w-3.5 h-3.5" />
                        {postStats.carousels} {postStats.carousels === 1 ? 'Carrossel' : 'Carrosséis'}
                      </span>
                    )}
                    {postStats.videos > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-400 border border-purple-500/20">
                        <Film className="w-3.5 h-3.5" />
                        {postStats.videos} {postStats.videos === 1 ? 'Vídeo' : 'Vídeos'}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-700/50 text-slate-300 border border-white/10">
                      {analyzedPosts.length} total
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                  {analyzedPosts.map(post => {
                    const config = mediaTypeConfig[post.media_type] || mediaTypeConfig.IMAGE;
                    const thumbnailPath = post.thumbnail_storage_path || post.media_storage_path;
                    const imageUrl = thumbnailPath
                      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/raio-x-media/${thumbnailPath}`
                      : null;

                    return (
                      <div key={post.id} className="bg-zinc-800/50 rounded-xl border border-white/5 overflow-hidden hover:border-white/15 transition-all group hover:shadow-lg hover:shadow-black/20">
                        {/* Media preview */}
                        <div className="relative aspect-square bg-zinc-900/80 overflow-hidden">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={post.caption?.substring(0, 50) || 'Post'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                              {post.media_type === 'VIDEO' ? <Film className="w-10 h-10" /> : <Image className="w-10 h-10" />}
                            </div>
                          )}

                          {/* Video play overlay */}
                          {post.media_type === 'VIDEO' && imageUrl && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
                                <Film className="w-5 h-5 text-white" />
                              </div>
                            </div>
                          )}

                          {/* Carousel indicator */}
                          {post.media_type === 'CAROUSEL_ALBUM' && (
                            <div className="absolute top-2 right-2">
                              <div className="bg-black/50 backdrop-blur rounded-md p-1">
                                <Sparkles className="w-3.5 h-3.5 text-white" />
                              </div>
                            </div>
                          )}

                          {/* Type badge */}
                          <div className="absolute bottom-2 left-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border backdrop-blur-sm ${config.color}`}>
                              {config.icon}
                              {config.label}
                            </span>
                          </div>
                        </div>

                        {/* Caption */}
                        <div className="p-3">
                          <span className="text-[10px] text-slate-500 block mb-1">{new Date(post.posted_at).toLocaleDateString('pt-BR')}</span>
                          <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                            {post.caption || <span className="italic text-slate-600">Sem legenda</span>}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RaioXPage() {
  return (
    <Suspense fallback={<div className="flex justify-center flex-col items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-white mb-4" /><span className="text-white">Carregando...</span></div>}>
      <RaioXContent />
    </Suspense>
  );
}
