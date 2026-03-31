'use client';

import { useState, useEffect, Suspense } from 'react';
import InstagramConnectForm from '@/components/raio-x/InstagramConnectForm';
import PersonaResult from '../../../components/raio-x/PersonaResult';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';

type AccountInfo = { igUserId: string; username: string; pageName: string; };

function RaioXContent() {
  const [status, setStatus] = useState<'IDLE' | 'SELECT_ACCOUNT' | 'ANALYSING' | 'DONE'>('IDLE');
  const [persona, setPersona] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [availableAccounts, setAvailableAccounts] = useState<AccountInfo[]>([]);

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
          } else {
            console.log("Nenhuma persona encontrada ou erro:", error?.message);
            if (searchParams?.get('step') === 'select_account' && searchParams?.get('token')) {
              console.log("Detectado ?step=select_account na URL, entrando em modo SELECT_ACCOUNT");
              setStatus('SELECT_ACCOUNT');
              fetchAccounts(searchParams.get('token') as string);
            } else if (searchParams?.get('success') === 'true') {
              console.log("Detectado ?success=true na URL, entrando em modo ANALYSING");
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
        if (status === 'IDLE' && !persona) {
          checkExistingPersona(session.user.id);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [searchParams, router, status, persona]);

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
    
    setStatus('ANALYSING'); // Temporary state while redirecting
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
          Vamos mapear a sua essência. Conecte seu perfil para que a nossa IA analise os posts e desenhe a sua Brand Persona oficial.
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
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <Loader2 className="w-16 h-16 text-brand animate-spin mb-6 drop-shadow-[0_0_15px_rgba(242,47,29,0.5)]" />
            <h3 className="text-2xl font-bold text-white mb-2">Processando dados do Instagram...</h3>
            <p className="text-slate-400 text-center max-w-md">
              Nossos agentes de IA estão analisando legendas, extraindo a psicologia por trás dos seus posts e definindo a sua Persona.
            </p>
          </div>
        )}

        {status === 'DONE' && persona && (
          <PersonaResult persona={persona} />
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
