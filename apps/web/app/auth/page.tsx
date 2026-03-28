"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const [view, setView] = useState("login"); // login, register, reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (view === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
      } else if (view === "register") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Verifique seu email para confirmar o registro.");
      } else if (view === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (error) throw error;
        setMessage("Email de recuperação enviado.");
      }
    } catch (err: any) {
      setError(err.message || "Erro de autenticação.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
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
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            {view === "login" && "Bem-vindo de volta"}
            {view === "register" && "Crie sua conta"}
            {view === "reset" && "Recuperar senha"}
          </h1>
          <p className="text-slate-400 text-sm">
            {view === "login" && "Entre para gerenciar seus carrosséis e templates."}
            {view === "register" && "Junte-se à nova era de criação com IA."}
            {view === "reset" && "Enviaremos um link para redefinir sua senha."}
          </p>
        </div>

        {error && <div className="bg-red-500/10 text-red-500 text-sm p-3 rounded-lg mb-4">{error}</div>}
        {message && <div className="bg-emerald-500/10 text-emerald-400 text-sm p-3 rounded-lg mb-4">{message}</div>}

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Seu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-slate-100 placeholder:text-zinc-600 focus:outline-none focus:border-brand/50 transition-colors"
          />
          
          {view !== "reset" && (
            <input
              type="password"
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-slate-100 placeholder:text-zinc-600 focus:outline-none focus:border-brand/50 transition-colors"
            />
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand/90 text-white font-medium py-3 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              view === "login" ? "Entrar" : view === "register" ? "Cadastrar" : "Enviar Email"
            )}
          </button>
        </form>

        {view !== "reset" && (
          <div className="mt-6">
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800"></div></div>
              <div className="relative flex justify-center text-xs"><span className="bg-zinc-900 px-2 text-zinc-500">OU</span></div>
            </div>
            <button
              onClick={handleGoogleLogin}
              type="button"
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
              Continuar com Google
            </button>
          </div>
        )}

        <div className="mt-8 text-center text-sm text-slate-400 flex flex-col gap-2">
          {view === "login" && (
            <>
              <button onClick={() => setView("reset")} className="hover:text-white transition-colors">Esqueceu a senha?</button>
              <span>Não tem uma conta? <button onClick={() => setView("register")} className="text-brand hover:text-red-400 transition-colors">Cadastre-se</button></span>
            </>
          )}
          {view === "register" && (
            <span>Já tem uma conta? <button onClick={() => setView("login")} className="text-brand hover:text-red-400 transition-colors">Entre</button></span>
          )}
          {view === "reset" && (
            <button onClick={() => setView("login")} className="hover:text-white transition-colors">Voltar para o Login</button>
          )}
        </div>
      </div>
    </div>
  );
}
