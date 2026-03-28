'use client';

import { useState } from 'react';
import InstagramConnectForm from '@/components/raio-x/InstagramConnectForm';
import PersonaResult from '../../../components/raio-x/PersonaResult';
import { Loader2 } from 'lucide-react';

export default function RaioXPage() {
  const [status, setStatus] = useState<'IDLE' | 'ANALYSING' | 'DONE'>('IDLE');
  const [persona, setPersona] = useState<any>(null);

  const handleConnect = () => {
    setStatus('ANALYSING');

    // MOCK TIMEOUT
    setTimeout(() => {
      setPersona({
        primary_goal: 'authority',
        content_niche: 'Marketing Digital e Criação de SaaS',
        tone_of_voice: 'Direto, sofisticado, motivador e especialista.',
        psychological_profile: 'Criador inovador, focado em alta performance e design premium.',
        visual_preferences: { colors: 'Preto, Branco, Vermelho Vibrante', style: 'Minimalista, Glassmorphism' }
      });
      setStatus('DONE');
    }, 3000);
  };

  return (
    <div className="max-w-screen-2xl mx-auto py-6">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2 drop-shadow-md">
          Raio-X do Criador
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          Vamos mapear a sua essência. Conecte seu perfil para que a nossa IA analise os posts e desenhe a sua Brand Persona oficial. (MOCK MODE)
        </p>
      </div>

      <div className="bg-zinc-900/40 border border-white/5 rounded-3xl shadow-2xl p-8 relative overflow-hidden backdrop-blur-2xl">
        {status === 'IDLE' && (
          <InstagramConnectForm onConnect={handleConnect} />
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
