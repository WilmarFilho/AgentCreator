"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { LayoutDashboard, Activity, Search, Palette, LogOut, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/auth");
      } else {
        setUser(session.user);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const navLinks = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "Raio-X", href: "/dashboard/ingestion", icon: Activity },
    { name: "Inteligência", href: "/dashboard/intelligence", icon: Search },
    { name: "Fábrica", href: "/dashboard/studio", icon: Palette },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-slate-50 flex flex-col font-sans">
      {/* Topbar */}
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-2xl border-b border-white/5 flex justify-center">
        {/* Troquei grid-cols-3 por flex ou ajustei o grid para dar mais espaço ao centro */}
        <div className="w-full max-w-screen-2xl px-4 md:px-6 h-20 flex items-center justify-between">

          {/* Left: Logo - Definimos uma largura mínima ou fixa para não espremer o resto */}
          <div className="flex items-center justify-start min-w-[150px]">
            <Link href="/dashboard" className="flex items-center transition-opacity hover:opacity-80">
              <span className="font-black tracking-tighter text-2xl text-brand drop-shadow-[0_0_15px_rgba(242,47,29,0.4)]">
                AgentCreator
              </span>
            </Link>
          </div>

          {/* Center: Navigation - Agora ele ocupa o espaço central de forma flexível */}
          <div className="hidden md:flex flex-1 justify-center px-4">
            <nav className="flex items-center gap-1 bg-zinc-900/50 p-1.5 rounded-full border border-white/5">
              {navLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    // Adicionado: whitespace-nowrap e text-base (opcional para aumentar o tamanho)
                    className={`relative px-4 py-2 text-sm font-medium transition-colors rounded-full whitespace-nowrap ${active ? "text-slate-50" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                      }`}
                  >
                    <div className="flex items-center gap-2 relative z-10">
                      <link.icon className={`w-4 h-4 ${active ? "text-brand" : ""}`} />
                      {link.name}
                    </div>
                    {active && (
                      <motion.div
                        layoutId="active-nav-indicator"
                        className="absolute inset-0 bg-white/10 rounded-full"
                        initial={false}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Profile & Actions - Definimos uma largura mínima para alinhar à direita */}
          <div className="flex items-center justify-end gap-x-5 min-w-[150px]">
            <div className="hidden sm:flex flex-col items-end">
              <p className="font-medium text-slate-200 text-sm leading-tight">
                {user?.user_metadata?.nome || user?.user_metadata?.full_name || "Criador"}
              </p>
              <p className="text-xs text-slate-500 leading-tight mt-0.5">{user?.email}</p>
            </div>
            <div className="w-px h-8 bg-zinc-800 hidden sm:block"></div>
            <button
              onClick={handleSignOut}
              className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        <div className=" max-w-screen-2xl mx-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
