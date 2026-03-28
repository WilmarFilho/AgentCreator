'use client';

import { Instagram } from 'lucide-react';

interface Props {
  onConnect: () => void;
}

export default function InstagramConnectForm({ onConnect }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-yellow-500 via-rose-500 to-fuchsia-600 rounded-[24px] mb-8 shadow-xl shadow-rose-500/20">
        <Instagram size={36} className="text-white" />
      </div>

      <h2 className="text-3xl font-bold text-slate-50 mb-3 text-center tracking-tight">
        Conectar Instagram
      </h2>
      <p className="text-slate-400 text-center mb-10 max-w-md">
        Autorize em nome da sua conta profissional para que nossa inteligência atue automaticamente analisando seu conteúdo. Sua conexão é 100% segura.
      </p>

      <button 
        onClick={onConnect}
        className="mt-2 flex w-full max-w-sm justify-center items-center gap-2 bg-gradient-to-r from-[#1877F2] to-[#1877F2]/80 text-white font-bold py-3.5 px-6 rounded-2xl hover:opacity-90 transition-all active:scale-[0.98]"
      >
        <span>Continuar com o Facebook</span>
      </button>
    </div>
  );
}
