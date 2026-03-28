"use client";

import { motion } from "framer-motion";
import { CopyPlus, TrendingUp, Sparkles, Image as ImageIcon, Activity, Palette } from "lucide-react";
import Link from "next/link";

export default function DashboardOverview() {
  const stats = [
    { title: "Carrosséis Gerados", value: "0", icon: CopyPlus, color: "text-blue-400" },
    { title: "Ideias Salvas", value: "3", icon: Sparkles, color: "text-amber-400" },
    { title: "Templates Ativos", value: "2", icon: ImageIcon, color: "text-emerald-400" },
    { title: "Trends Analisadas", value: "14", icon: TrendingUp, color: "text-brand" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Visão Geral</h1>
        <p className="text-slate-400">
          Bem-vindo ao seu painel principal de inteligência. Acompanhe suas métricas e inicie novas criações.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.1 }}
            className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-400">{stat.title}</span>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-3xl font-bold text-slate-50">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-2xl backdrop-blur-xl">
          <h2 className="text-xl font-bold mb-4">Ações Rápidas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/dashboard/raio-x">
              <div className="p-4 rounded-xl border border-zinc-800 hover:border-brand/50 bg-zinc-900 transition-colors group cursor-pointer h-full">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center mb-3 group-hover:bg-brand/20 transition-colors">
                  <Activity className="w-5 h-5 text-brand" />
                </div>
                <h3 className="font-semibold text-slate-100 mb-1">Passo 1: Raio-X</h3>
                <p className="text-sm text-slate-400">
                  Descubra seu perfil analisando seu histórico.
                </p>
              </div>
            </Link>
            <Link href="/dashboard/studio">
              <div className="p-4 rounded-xl border border-zinc-800 hover:border-blue-500/50 bg-zinc-900 transition-colors group cursor-pointer h-full">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-3 group-hover:bg-blue-500/20 transition-colors">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="font-semibold text-slate-100 mb-1">Passo 2: Estúdio</h3>
                <p className="text-sm text-slate-400">
                  Descubra pautas virais e escreva suas copies baseadas na IA.
                </p>
              </div>
            </Link>
            <Link href="/dashboard/factory">
              <div className="p-4 rounded-xl border border-zinc-800 hover:border-emerald-500/50 bg-zinc-900 transition-colors group cursor-pointer h-full sm:col-span-2 md:col-span-1">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3 group-hover:bg-emerald-500/20 transition-colors">
                  <Palette className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="font-semibold text-slate-100 mb-1">Passo 3: Fábrica</h3>
                <p className="text-sm text-slate-400">
                  Transforme suas copies em carrosséis visuais deslumbrantes.
                </p>
              </div>
            </Link>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-2xl backdrop-blur-xl">
          <h2 className="text-xl font-bold mb-4">Notificações</h2>
          <div className="flex flex-col gap-4">
            <div className="flex gap-3 items-start border-l-2 border-brand pl-3">
              <div>
                <p className="text-sm text-slate-200">Plataforma Atualizada</p>
                <p className="text-xs text-slate-500 mt-1">Bem-vindo ao AgentCreator. Configure seu nicho no menu Raio-X.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
