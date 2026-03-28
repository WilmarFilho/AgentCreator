"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Instagram, Link as LinkIcon, AlertCircle, ScanFace, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";

export default function IngestionPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Form states
  const [niche, setNiche] = useState("");
  const [goal, setGoal] = useState("crescimento");

  const handleConnect = () => {
    // Mocking the Instagram connection delay
    setAnalyzing(true);
    setTimeout(() => {
      setIsConnected(true);
      setAnalyzing(false);
    }, 1500);
  };

  const handleAnalyzeTone = (e: React.FormEvent) => {
    e.preventDefault();
    setAnalyzing(true);
    // Mocking the LLM analysis processing time
    setTimeout(() => {
      setShowResults(true);
      setAnalyzing(false);
    }, 2500);
  };

  return (
    <div className="flex flex-col gap-8 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Fase 1: O Raio-X</h1>
        <p className="text-slate-400 max-w-2xl">
          Conecte seu Instagram e defina seus objetivos. Nossa IA vai analisar suas últimas postagens para entender o seu Perfil Psicológico e o seu Tom de Voz exato.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Connections and Forms */}
        <div className="flex flex-col gap-6">
          {/* Instagram Connect Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-2xl border backdrop-blur-xl transition-colors ${
              isConnected 
                ? "bg-emerald-500/5 border-emerald-500/20" 
                : "bg-zinc-900/50 border-zinc-800/50"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${isConnected ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-slate-300"}`}>
                  <Instagram className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Conta do Instagram</h3>
                  <p className="text-sm text-slate-400">
                    {isConnected ? "@creator_agent" : "Nenhuma conta vinculada"}
                  </p>
                </div>
              </div>
              {isConnected ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-500" />
              )}
            </div>

            {!isConnected ? (
              <button
                onClick={handleConnect}
                disabled={analyzing}
                className="w-full mt-2 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-slate-200 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {analyzing ? (
                  <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"></div> Conectando...</span>
                ) : (
                  <span className="flex items-center gap-2"><LinkIcon className="w-4 h-4" /> Autenticar Conta</span>
                )}
              </button>
            ) : (
              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400 flex items-center gap-2">
                Conectado com sucesso. Status da API: Online.
              </div>
            )}
          </motion.div>

          {/* Niche & Goals Form */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-2xl border border-zinc-800/50 bg-zinc-900/50 backdrop-blur-xl"
          >
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <ScanFace className="w-5 h-5 text-brand" /> 
              Direcionamento
            </h3>
            
            <form onSubmit={handleAnalyzeTone} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-slate-300 font-medium">Seu Nicho Principal</label>
                <input
                  type="text"
                  required
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="Ex: Finanças, Empreendedorismo, Fitness..."
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand/50 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm text-slate-300 font-medium">Objetivo do Conteúdo</label>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand/50 transition-colors appearance-none"
                >
                  <option value="crescimento">Crescimento de Audiência (Topo de Funil)</option>
                  <option value="autoridade">Construção de Autoridade (Meio de Funil)</option>
                  <option value="venda">Conversão / Vendas (Fundo de Funil)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={!isConnected || analyzing || niche === ""}
                className="mt-4 bg-brand hover:bg-red-500 text-white font-medium py-3 rounded-lg shadow-[0_0_15px_rgba(242,47,29,0.2)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {analyzing && niche !== "" ? (
                  <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Extraindo Tom de Voz...</span>
                ) : (
                  <span>Analisar Perfil & Tom de Voz</span>
                )}
              </button>
            </form>
          </motion.div>
        </div>

        {/* Right Column: AI Analysis Results */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col h-full"
        >
          <div className={`flex-1 rounded-2xl border p-6 flex flex-col transition-all duration-500 ${
            showResults 
              ? "bg-zinc-900/80 border-brand/30 shadow-[0_0_30px_rgba(242,47,29,0.05)]" 
              : "bg-zinc-900/30 border-zinc-800/50 items-center justify-center text-center"
          }`}>
            
            {!showResults ? (
              <div className="max-w-xs space-y-4">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ScanFace className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-300">Aguardando Análise</h3>
                <p className="text-sm text-slate-500">
                  Conecte sua conta e inicie a extração acima para gerar seu Perfil Psicológico.
                </p>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-brand" />
                    Diagnóstico Concluído
                  </h3>
                  <span className="text-xs font-mono bg-brand/10 text-brand px-2 py-1 rounded">MATCH: 98%</span>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">Perfil Psicológico</h4>
                    <p className="text-slate-200 text-sm leading-relaxed">
                      O perfil apresenta um arquétipo do "Sábio" misturado com "Criador". Demonstra alta competência técnica no nicho de <span className="text-brand font-medium">{niche}</span>, buscando transferir conhecimento de forma estruturada.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-400 mb-2 uppercase tracking-wider">Tom de Voz Extraído</h4>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="bg-zinc-800 border border-zinc-700 text-xs px-2 py-1 rounded-md text-slate-300">Autêntico</span>
                      <span className="bg-zinc-800 border border-zinc-700 text-xs px-2 py-1 rounded-md text-slate-300">Direto</span>
                      <span className="bg-zinc-800 border border-zinc-700 text-xs px-2 py-1 rounded-md text-slate-300">Didático</span>
                      <span className="bg-zinc-800 border border-zinc-700 text-xs px-2 py-1 rounded-md text-slate-300">Pouco uso de emojis</span>
                    </div>
                    <p className="text-slate-200 text-sm leading-relaxed italic bg-zinc-950 p-3 rounded-lg border border-zinc-800/50">
                      "A linguagem é objetiva, quebra expectativas logo no gancho e foca em listas práticas (A, B, C) sem jargões complexos desnecessários."
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-auto">
                  <button className="w-full bg-white text-zinc-950 hover:bg-slate-200 font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2 group">
                    Ir para Fase 2: Explorar Trends
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

    </div>
  );
}
