"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;
      setMessage("Senha atualizada com sucesso!");
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err: any) {
      setError(err.message || "Falha ao definir nova senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 p-8 rounded-2xl shadow-xl">
        <div className="text-center mb-8">
          <span className="text-brand font-semibold tracking-wider uppercase text-sm mb-2 block">
            AgentCreator
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Nova Senha</h1>
          <p className="text-slate-400 text-sm">Defina uma nova senha forte para sua conta.</p>
        </div>

        {error && <div className="bg-red-500/10 text-red-500 text-sm p-3 rounded-lg mb-4">{error}</div>}
        {message && <div className="bg-emerald-500/10 text-emerald-400 text-sm p-3 rounded-lg mb-4">{message}</div>}

        <form onSubmit={handleReset} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="Sua nova senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-slate-100 placeholder:text-zinc-600 focus:outline-none focus:border-brand/50 transition-colors"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand/90 text-white font-medium py-3 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Atualizar Senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
