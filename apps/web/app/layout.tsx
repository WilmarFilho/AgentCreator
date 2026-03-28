import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AgentCreator | AI Carousel Generator",
  description: "Gere carrosséis incríveis para o Instagram usando IA.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-zinc-950 text-slate-50 font-sans selection:bg-brand/30">
        {children}
      </body>
    </html>
  );
}
