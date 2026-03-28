"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        router.push("/dashboard");
      }
    });

    // In case there is an error in URL hash
    if (window.location.hash.includes("error_description")) {
       setError("Falha ao autenticar. Tente novamente.");
    }
  }, [router]);

  return (
    <div className="flex bg-zinc-950 items-center justify-center min-h-screen text-white">
      {error ? (
        <div className="text-red-400 text-center">
            <p>{error}</p>
            <button onClick={() => router.push("/auth")} className="mt-4 text-brand">Voltar</button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-brand" />
            <p className="text-slate-400">Verificando sua sessão...</p>
        </div>
      )}
    </div>
  );
}
