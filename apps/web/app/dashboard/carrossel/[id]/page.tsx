'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, ArrowLeft, Download, Layers, AlignLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CarouselFactoryPage({ params }: { params: { id: string } }) {
  const [carousel, setCarousel] = useState<any>(null);
  const [status, setStatus] = useState<string>('generating_copy');
  const [activeSlide, setActiveSlide] = useState(0);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchCarousel();

    // Setup Realtime listener to watch when AI finishes generating the carousel slides
    const channel = supabase
      .channel('carousel-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'generated_carousels', filter: `id=eq.${params.id}` },
        (payload) => {
          if (payload.new.status === 'ready') {
            setStatus('ready');
            fetchCarousel(); // Refetch to get slides
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [params.id, supabase]);

  const fetchCarousel = async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/factory/carousel/${params.id}`);
      if (!res.ok) throw new Error('Falha ao buscar carrossel');
      const data = await res.json();
      setCarousel(data);
      setStatus(data.status);
    } catch (e) {
      console.error(e);
    }
  };

  const slides = carousel?.carousel_slides || [];
  const theme = carousel?.design_templates?.design_schema?.theme || 'dark';

  return (
    <div className="max-w-screen-2xl mx-auto py-6 px-6 h-[calc(100vh-80px)] flex flex-col">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/studio" className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              <Layers className="text-brand" /> Editor de Carrossel
            </h1>
            <p className="text-slate-400 text-sm">Preview Dinâmico do Instagram</p>
          </div>
        </div>

        {status === 'ready' && (
          <button className="flex items-center gap-2 bg-brand text-white font-bold py-2.5 px-6 rounded-xl hover:bg-brand/90 transition-all shadow-lg shadow-brand/20">
            <Download size={18} /> Exportar como Imagens
          </button>
        )}
      </div>

      {/* CONTENT */}
      {status !== 'ready' ? (
         <div className="flex-1 flex flex-col items-center justify-center animate-pulse opacity-80 pb-20">
            <Loader2 className="w-16 h-16 text-brand animate-spin mb-6 drop-shadow-[0_0_15px_rgba(242,47,29,0.5)]" />
            <h2 className="text-3xl font-bold text-white mb-2">Engrenagens Girando...</h2>
            <p className="text-slate-400 text-lg max-w-md text-center">
              Nosso copywriter de IA está escrevendo os slides e roteirizando o seu carrossel seguindo sua Brand Persona.
            </p>
         </div>
      ) : (
         <div className="flex-1 flex flex-col lg:flex-row gap-8 min-h-0">
            {/* Editor Lateral */}
            <div className="w-full lg:w-1/3 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
              <div className="bg-zinc-900/40 p-6 rounded-3xl border border-white/5 space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                     <AlignLeft size={16} /> Legenda do Post
                  </h3>
                  <textarea 
                    className="w-full h-48 bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none font-medium leading-relaxed"
                    defaultValue={carousel?.main_caption}
                  />
                </div>

                <div>
                   <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">
                     Configurar Template
                   </h3>
                   <div className="p-4 bg-black/20 rounded-2xl text-slate-400 text-sm border border-white/5">
                      <strong>Template Atual:</strong> {carousel?.design_templates?.name} <br/>
                      A customização detalhada do template estará disponível na Fase 3 completa (Canvas).
                   </div>
                </div>
              </div>
            </div>

            {/* Preview do Instagram (Canvas Simulado MOCK) */}
            <div className="w-full lg:w-2/3 flex flex-col items-center justify-center bg-zinc-950/50 rounded-3xl border border-white/5 relative overflow-hidden">
               {/* Instagram Aspect Ratio Container (1080x1350 is 4:5 ratio) */}
               <div className="relative w-full max-w-[400px] aspect-[4/5] bg-gradient-to-br from-zinc-800 to-zinc-900 shadow-2xl rounded-sm overflow-hidden flex flex-col justify-center items-center p-12 text-center group cursor-pointer transition-all hover:scale-[1.02]">
                  
                  {/* Fake UI Header Insta */}
                  <div className="absolute top-0 left-0 w-full p-4 flex items-center justify-between opacity-50">
                     <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-400 border border-white/20" />
                        <span className="text-xs font-bold text-white">seu_perfil</span>
                     </div>
                     <span className="text-xs font-bold text-white bg-black/40 px-2 py-1 rounded-full">{activeSlide + 1} / {slides.length}</span>
                  </div>

                  {/* Renderizando o slide selecionado */}
                  {slides[activeSlide] && (
                     <>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug drop-shadow-lg mb-6 max-w-[90%]">
                           {slides[activeSlide].copy_text}
                        </h2>
                        
                        {/* Fake Prompt visual representation */}
                        {slides[activeSlide].ai_image_prompt && (
                          <p className="absolute bottom-6 left-6 right-6 text-[10px] text-white/30 font-mono text-left bg-black/40 p-2 rounded">
                            prompt: {slides[activeSlide].ai_image_prompt}
                          </p>
                        )}
                     </>
                  )}

                  {/* Navigation Arrows inside Canvas */}
                  {activeSlide > 0 && (
                     <button onClick={() => setActiveSlide(s => s - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 p-2 rounded-full text-white/80 hover:bg-black/80 hover:scale-110 backdrop-blur-md transition-all">
                        <ArrowLeft size={20} />
                     </button>
                  )}
                  {activeSlide < slides.length - 1 && (
                     <button onClick={() => setActiveSlide(s => s + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 p-2 rounded-full text-white/80 hover:bg-black/80 hover:scale-110 backdrop-blur-md transition-all rotate-180">
                        <ArrowLeft size={20} />
                     </button>
                  )}
               </div>

               <div className="mt-8 flex gap-2">
                  {slides.map((_: any, i: number) => (
                     <button 
                        key={i} 
                        onClick={() => setActiveSlide(i)}
                        className={`w-2.5 h-2.5 rounded-full transition-all ${activeSlide === i ? 'bg-brand scale-125' : 'bg-white/20 hover:bg-white/40'}`}
                     />
                  ))}
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
