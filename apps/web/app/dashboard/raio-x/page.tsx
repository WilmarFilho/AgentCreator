'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import InstagramConnectForm from '@/components/raio-x/InstagramConnectForm';
import PersonaResult from '../../../components/raio-x/PersonaResult';
import { Loader2, Image, Film, Type, Sparkles, ChevronDown, Save, CheckCircle2, Target, Globe, Download, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

type AccountInfo = { igUserId: string; username: string; pageName: string; };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const INITIAL_VISIBLE_POSTS = 10;

// ─── PostCard (memoized for performance) ──────────────────────────────
const PostCard = ({ post }: { post: any }) => {
  const isCarousel = post.media_type === 'CAROUSEL_ALBUM';

  const mediaPath = post.media_storage_path;
  const mediaUrl = mediaPath
    ? `${SUPABASE_URL}/storage/v1/object/public/raio-x-media/${mediaPath}`
    : null;

  const config = isCarousel
    ? { label: 'Carrossel', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
    : { label: 'Foto', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };

  return (
    <div className="bg-zinc-800/50 rounded-xl border border-white/5 overflow-hidden hover:border-white/15 transition-all group hover:shadow-lg hover:shadow-black/20">
      <div className="relative aspect-square bg-zinc-900/80 overflow-hidden">
        {mediaUrl ? (
          (
            <img
              src={mediaUrl}
              alt={post.caption?.substring(0, 50) || 'Post'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              decoding="async"
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <Image className="w-10 h-10" />
          </div>
        )}

        {mediaUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none group-hover:opacity-0 transition-opacity">
            <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
              <Film className="w-5 h-5 text-white" />
            </div>
          </div>
        )}

        {isCarousel && (
          <div className="absolute top-2 right-2">
            <div className="bg-black/50 backdrop-blur rounded-md p-1">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
        )}

        <div className="absolute bottom-2 left-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border backdrop-blur-sm ${config.color}`}>
            {isCarousel ? <Sparkles className="w-3 h-3" /> : <Image className="w-3 h-3" />}
            {config.label}
          </span>
        </div>
      </div>

      <div className="p-3">
        <span className="text-[10px] text-slate-500 block mb-1">
          {new Date(post.posted_at).toLocaleDateString('pt-BR')}
        </span>
        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
          {post.caption || <span className="italic text-slate-600">Sem legenda</span>}
        </p>
      </div>
    </div>
  );
};

// ─── ObjectivesForm ───────────────────────────────────────────────────
const OBJECTIVES_FIELDS = [
  { key: 'business_type', label: 'Tipo de Negócio', placeholder: 'Ex: Loja de roupas, Coach, SaaS, Infoproduto...' },
  { key: 'target_audience', label: 'Público-Alvo', placeholder: 'Ex: Mulheres 25-40, empreendedores iniciantes...' },
  { key: 'content_goals', label: 'Objetivos com Conteúdo', placeholder: 'Ex: Gerar autoridade, vender cursos, atrair clientes...' },
  { key: 'monetization_strategy', label: 'Estratégia de Monetização', placeholder: 'Ex: Vendas diretas, afiliados, consultorias...' },
  { key: 'brand_values', label: 'Valores da Marca', placeholder: 'Ex: Transparência, inovação, proximidade...' },
  { key: 'competitors', label: 'Concorrente Direto (apenas 1 @)', placeholder: 'Ex: @concorrente' },
  { key: 'extra_notes', label: 'Observações Extras', placeholder: 'Informações adicionais relevantes...' },
];

function ObjectivesForm({ profileId }: { profileId: string }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [initialCompetitor, setInitialCompetitor] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  useEffect(() => {
    if (!profileId) return;
    fetch(`${API_URL}/api/raio-x/objectives?profileId=${profileId}`)
      .then(r => r.json())
      .then(data => {
        if (data) {
          const existing: Record<string, string> = {};
          OBJECTIVES_FIELDS.forEach(f => {
            if (data[f.key]) existing[f.key] = data[f.key];
          });
          setForm(existing);
          if (data.competitors) {
            setInitialCompetitor(data.competitors.trim());
          }
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [profileId]);

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 5000);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    
    // Clean competitors field to make sure it's a single handle
    let rawCompetitor = (form['competitors'] || '').trim();
    if (rawCompetitor.includes('instagram.com/')) {
        const parts = rawCompetitor.split('.com/');
        rawCompetitor = parts[1]?.replace('/', '').split('?')[0] || rawCompetitor;
    }
    rawCompetitor = rawCompetitor.startsWith('@') ? rawCompetitor : (rawCompetitor ? `@${rawCompetitor}` : '');
    const updatedForm = { ...form, competitors: rawCompetitor };
    setForm(updatedForm);

    try {
      const res = await fetch(`${API_URL}/api/raio-x/objectives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, objectives: updatedForm }),
      });
      if (res.ok) {
        setSaved(true);
        if (rawCompetitor && rawCompetitor !== initialCompetitor) {
          showToast(`Analisando perfil de ${rawCompetitor} em segundo plano...`);
          setInitialCompetitor(rawCompetitor);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="relative bg-zinc-900/60 border border-white/5 rounded-3xl p-8 backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Toast Notification no canto superior direito */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-zinc-800 text-white font-medium border border-brand/50 px-6 py-4 rounded-xl shadow-[0_0_15px_rgba(242,47,29,0.3)] flex items-center justify-between gap-4 animate-in fade-in slide-in-from-right-8 duration-500">
           <div className="flex items-center gap-3">
             <Loader2 className="w-5 h-5 animate-spin text-brand" />
             <span>{toast.message}</span>
           </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-brand/10 text-brand rounded-xl flex items-center justify-center">
          <Target size={20} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Seus Objetivos</h3>
          <p className="text-sm text-slate-500">Essas informações serão usadas para personalizar sugestões e estratégias de conteúdo.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {OBJECTIVES_FIELDS.map(field => (
          <div key={field.key} className={field.key === 'extra_notes' ? 'md:col-span-2' : ''}>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              {field.label}
            </label>
            {field.key === 'extra_notes' ? (
              <textarea
                value={form[field.key] || ''}
                onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                rows={3}
                className="w-full bg-zinc-800/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/30 transition-colors resize-none"
              />
            ) : (
              <input
                type="text"
                value={form[field.key] || ''}
                onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full bg-zinc-800/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/30 transition-colors"
                maxLength={field.key === 'competitors' ? 30 : undefined}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-brand text-white font-bold py-3 px-6 rounded-xl hover:bg-brand/90 transition-all active:scale-95 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? 'Salvo!' : 'Salvar Objetivos'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────
function RaioXContent() {
  const [status, setStatus] = useState<'IDLE' | 'SELECT_ACCOUNT' | 'ANALYSING' | 'DONE'>('IDLE');
  const [persona, setPersona] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [availableAccounts, setAvailableAccounts] = useState<AccountInfo[]>([]);

  // Benchmark pipeline state
  const [benchmarkStep, setBenchmarkStep] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [downloadingJsonl, setDownloadingJsonl] = useState(false);
  const [benchmarkMsg, setBenchmarkMsg] = useState('');
  const [analyzedPosts, setAnalyzedPosts] = useState<any[]>([]);
  const [showAllPosts, setShowAllPosts] = useState(false);

  const fetchPosts = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase.from('post_metrics')
        .select('id,media_type,caption,posted_at,media_storage_path,thumbnail_storage_path')
        .eq('profile_id', uid)
        .order('posted_at', { ascending: false })
        .limit(20);
      if (data && !error) setAnalyzedPosts(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    async function checkExistingPersona(uid: string) {
      if (!mounted) return;
      try {
        const { data, error } = await supabase.from('brand_personas')
          .select('*')
          .eq('profile_id', uid)
          .single();

        if (mounted) {
          if (data && !error) {
            setPersona(data);
            setStatus('DONE');
            fetchPosts(uid);
          } else {
            if (searchParams?.get('step') === 'select_account' && searchParams?.get('token')) {
              setStatus('SELECT_ACCOUNT');
              fetchAccounts(searchParams.get('token') as string);
            } else if (searchParams?.get('success') === 'true') {
              setStatus('ANALYSING');
              router.replace('/dashboard/raio-x', { scroll: false });
            }
          }
          setLoadingUser(false);
        }
      } catch (err) {
        console.error(err);
        if (mounted) setLoadingUser(false);
      }
    }

    async function fetchAccounts(token: string) {
      try {
        const res = await fetch(`${API_URL}/api/raio-x/accounts?token=${token}`);
        if (!res.ok) throw new Error('Falha ao buscar contas');
        const data = await res.json();
        if (mounted) setAvailableAccounts(data);
      } catch (err) {
        console.error(err);
        if (mounted) {
          alert('Erro ao buscar contas do Instagram. Tente conectar novamente.');
          setStatus('IDLE');
        }
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        if (session?.user) {
          setUserId(session.user.id);
          checkExistingPersona(session.user.id);
        } else {
          setLoadingUser(false);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (mounted && session?.user) setUserId(session.user.id);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [searchParams, router, fetchPosts]);

  useEffect(() => {
    if (status === 'ANALYSING' && userId) {
      const channel = supabase
        .channel('brand_personas_changes')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'brand_personas',
          filter: `profile_id=eq.${userId}`,
        }, (payload: any) => {
          setPersona(payload.new);
          setStatus('DONE');
          fetchPosts(userId);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [status, userId, fetchPosts]);

  const handleConnect = () => {
    if (!userId) {
      alert("Aguardando carregamento da sessão...");
      return;
    }
    setStatus('ANALYSING');
    window.location.href = `${API_URL}/api/raio-x/oauth/facebook?profileId=${userId}`;
  };

  const handleAccountSelect = async (account: AccountInfo) => {
    setStatus('ANALYSING');
    try {
      const token = searchParams?.get('token');
      const res = await fetch(`${API_URL}/api/raio-x/start`, {
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

  const postStats = useMemo(() => ({
    images: analyzedPosts.filter(p => p.media_type === 'IMAGE').length,
    videos: analyzedPosts.filter(p => p.media_type === 'VIDEO').length,
    carousels: analyzedPosts.filter(p => p.media_type === 'CAROUSEL_ALBUM').length,
  }), [analyzedPosts]);

  const visiblePosts = useMemo(() =>
    showAllPosts ? analyzedPosts : analyzedPosts.slice(0, INITIAL_VISIBLE_POSTS),
    [analyzedPosts, showAllPosts]
  );

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
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-6">
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

            {/* Posts Grid */}
            {analyzedPosts.length > 0 && (
              <div className="bg-zinc-900/60 border border-white/5 rounded-3xl p-8 backdrop-blur-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                  <h3 className="text-2xl font-bold text-white">Posts Analisados</h3>
                  <div className="flex gap-3 flex-wrap">
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
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-700/50 text-slate-300 border border-white/10">
                      {analyzedPosts.length} total
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                  {visiblePosts.map(post => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>

                {/* Show More Button */}
                {!showAllPosts && analyzedPosts.length > INITIAL_VISIBLE_POSTS && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={() => setShowAllPosts(true)}
                      className="flex items-center gap-2 px-6 py-2.5 bg-zinc-800/60 hover:bg-zinc-700/60 border border-white/10 rounded-xl text-sm text-slate-300 font-medium transition-colors"
                    >
                      <ChevronDown className="w-4 h-4" />
                      Ver todos ({analyzedPosts.length - INITIAL_VISIBLE_POSTS} restantes)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Creator Objectives Form */}
            {userId && <ObjectivesForm profileId={userId} />}
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
