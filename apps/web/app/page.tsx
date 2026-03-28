"use client";

import Link from "next/link";
import { CopyPlus, Sparkles, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center overflow-hidden relative">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand/10 blur-[150px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-4xl w-full z-10"
      >
        <div className="flex items-center justify-center mb-6">
          <div className="px-4 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/50 backdrop-blur-md text-sm text-slate-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand" />
            <span>Versão 1.0 Alpha</span>
          </div>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6">
          Sua Fábrica de Carrosséis <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-brand">
            Movida a IA.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 mb-10 mx-auto max-w-2xl">
          Conecte sua conta do Instagram, defina seu tom de voz e deixe a AgentCreator gerar carrosséis perfeitos para o seu nicho.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/auth">
            <button className="px-8 py-4 bg-brand hover:bg-red-500 text-white font-medium rounded-xl text-lg transition-all shadow-[0_0_20px_rgba(242,47,29,0.3)] hover:shadow-[0_0_30px_rgba(242,47,29,0.5)] transform hover:-translate-y-0.5">
              Começar Agora
            </button>
          </Link>
          <a href="#features" className="px-8 py-4 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white font-medium rounded-xl text-lg transition-all">
            Descubra Mais
          </a>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 text-left" id="features">
          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6 text-brand" />
            </div>
            <h3 className="text-xl font-bold mb-2">Trend Hunting</h3>
            <p className="text-slate-400">Análise as tendências e as últimas notícias do seu nicho para produzir conteúdos que importam.</p>
          </div>
          
          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-brand" />
            </div>
            <h3 className="text-xl font-bold mb-2">Seu Tom de Voz</h3>
            <p className="text-slate-400">Extraímos as diretrizes psicológicas da sua conta para que a escrita fique 100% idêntica a você.</p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-4">
              <CopyPlus className="w-6 h-6 text-brand" />
            </div>
            <h3 className="text-xl font-bold mb-2">A Fábrica (Studio)</h3>
            <p className="text-slate-400">Gere imagens renderizadas (html-to-image) completas que puxam seus templates minimalistas e estéticos.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
