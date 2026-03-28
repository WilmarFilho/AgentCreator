'use client';

import { useEffect, useState } from 'react';
import { Layers, ArrowLeft, Download, Check, Palette, Image as ImageIcon, Type, Sparkles, LayoutList, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function FactoryPage() {
  const [savedCopies, setSavedCopies] = useState<any[]>([]);
  const [activeCopyId, setActiveCopyId] = useState<string | null>(null);
  
  // Wizard Steps
  // 1: Select Copy, 2: Select Template, 3: Apply Text, 4: Simulate Image Gen, 5: Apply Images
  const [currentStep, setCurrentStep] = useState(1);
  const [activeTemplate, setActiveTemplate] = useState('minimalista');
  const [slides, setSlides] = useState<any[]>([]);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [imagesApplied, setImagesApplied] = useState(false);
  const [textsApplied, setTextsApplied] = useState(false);

  useEffect(() => {
    // Load local storage copies
    const copies = JSON.parse(localStorage.getItem('saved_copies') || '[]');
    const tempActiveUrl = localStorage.getItem('mock_copy_active');
    
    let allCopies = [...copies];
    
    if (tempActiveUrl) {
      const activeObj = JSON.parse(tempActiveUrl);
      if (!allCopies.find(c => c.id === activeObj.id)) {
        allCopies.unshift(activeObj);
      }
      setActiveCopyId(activeObj.id);
    } else if (allCopies.length > 0) {
      setActiveCopyId(allCopies[0].id);
    }
    
    setSavedCopies(allCopies);
  }, []);

  const handleApplyTexts = () => {
    const copyToUse = savedCopies.find(c => c.id === activeCopyId);
    if (!copyToUse) return;

    const rawSlides = copyToUse.copy.split('\n\n').filter((s: string) => s.trim().length > 0);
    setSlides(rawSlides.map((s: string) => ({ copy_text: s, mock_image: null })));
    setTextsApplied(true);
    setCurrentStep(4);
  };

  const handleGenerateImages = () => {
    setIsGeneratingImages(true);
    setTimeout(() => {
      setIsGeneratingImages(false);
      // Give them mock placeholder images
      setSlides(curr => curr.map((s, i) => ({
        ...s, 
        mock_image: `https://picsum.photos/seed/${activeCopyId}_${i}/400/500`
      })));
      setImagesApplied(true);
      setCurrentStep(5);
    }, 2500);
  };

  const getTemplateClasses = (slideIndex: number) => {
    switch (activeTemplate) {
      case 'noticiario': return 'bg-white text-zinc-950 font-serif text-left border-b-8 border-red-600';
      case 'criador': return 'bg-gradient-to-br from-indigo-900 via-brand to-black text-white font-sans text-center';
      case 'minimalista':
      default: return 'bg-zinc-900 text-white font-sans text-center border border-white/5';
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto py-6 h-[calc(100vh-80px)] flex flex-col">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/studio" className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              <Layers className="text-brand" /> Fábrica de Artes
            </h1>
            <p className="text-slate-400 text-sm">Geração de Carrossel Visual Premium (GRID MODE)</p>
          </div>
        </div>

        <button 
          disabled={!imagesApplied}
          className="flex items-center gap-2 bg-brand text-white font-bold py-2.5 px-6 rounded-xl hover:bg-brand/90 transition-all shadow-[0_0_15px_rgba(242,47,29,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          <Download size={18} /> Exportar Lote (.PNG)
        </button>
      </div>

      {/* CONTENT */}
      <div className="flex-1 flex flex-col lg:flex-row gap-8 min-h-0">
         
         {/* WIZARD LATERAL (Steps) */}
         <div className="w-full lg:w-96 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar shrink-0">
           
           {/* Step 1: Copy */}
           <div className={`p-6 rounded-3xl border transition-all ${currentStep === 1 ? 'bg-zinc-900/80 border-white/20 shadow-lg' : 'bg-zinc-900/30 border-white/5 opacity-50'}`}>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <LayoutList size={16} className={currentStep === 1 ? 'text-brand' : ''} /> 1. Escolha a Copy
              </h3>
              {currentStep === 1 && (
                <div className="space-y-3">
                  {savedCopies.length === 0 && <p className="text-xs text-slate-500">Nenhuma copy salva.</p>}
                  {savedCopies.map(c => (
                    <button 
                      key={c.id}
                      onClick={() => setActiveCopyId(c.id)}
                      className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${activeCopyId === c.id ? 'border-brand bg-brand/10 text-white' : 'border-white/5 hover:bg-white/5 text-slate-400'}`}
                    >
                      {c.title || 'Copy Sem Título'}
                    </button>
                  ))}
                  <button 
                    onClick={() => setCurrentStep(2)}
                    disabled={!activeCopyId}
                    className="w-full mt-4 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg font-bold text-sm disabled:opacity-50"
                  >
                    Confirmar Seleção
                  </button>
                </div>
              )}
           </div>

           {/* Step 2: Template */}
           <div className={`p-6 rounded-3xl border transition-all ${currentStep === 2 ? 'bg-zinc-900/80 border-white/20 shadow-lg' : 'bg-zinc-900/30 border-white/5 opacity-50'}`}>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <Palette size={16} className={currentStep === 2 ? 'text-brand' : ''} /> 2. Escolha o Design
              </h3>
              {currentStep === 2 && (
                <div className="space-y-3">
                  {['minimalista', 'noticiario', 'criador'].map(tpl => (
                    <button 
                      key={tpl}
                      onClick={() => setActiveTemplate(tpl)}
                      className={`w-full text-left p-3 rounded-xl border text-sm capitalize transition-all ${activeTemplate === tpl ? 'border-brand bg-brand/10 text-white' : 'border-white/5 hover:bg-white/5 text-slate-400'}`}
                    >
                      {tpl}
                    </button>
                  ))}
                  <button 
                    onClick={() => setCurrentStep(3)}
                    className="w-full mt-4 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg font-bold text-sm"
                  >
                    Confirmar Design
                  </button>
                </div>
              )}
           </div>

           {/* Step 3: Aplicar Textos */}
           <div className={`p-6 rounded-3xl border transition-all ${currentStep === 3 ? 'bg-zinc-900/80 border-white/20 shadow-lg' : 'bg-zinc-900/30 border-white/5 opacity-50'}`}>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <Type size={16} className={currentStep === 3 ? 'text-brand' : ''} /> 3. Aplicar Textos
              </h3>
              {currentStep === 3 && (
                <button 
                  onClick={handleApplyTexts}
                  className="w-full bg-brand text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand/90"
                >
                  Mesclar Textos no Layout <ArrowLeft size={16} className="rotate-180" />
                </button>
              )}
           </div>

           {/* Step 4: Gerar Imagens IA */}
           <div className={`p-6 rounded-3xl border transition-all ${currentStep === 4 ? 'bg-zinc-900/80 border-white/20 shadow-lg' : 'bg-zinc-900/30 border-white/5 opacity-50'}`}>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <Sparkles size={16} className={currentStep === 4 ? 'text-brand' : ''} /> 4. Gerar Imagens IA
              </h3>
              {currentStep === 4 && (
                <div>
                  <p className="text-xs text-slate-400 mb-4">A IA vai gerar elementos visuais contextuais para cada slide baseado na sua pauta.</p>
                  <button 
                    onClick={handleGenerateImages}
                    disabled={isGeneratingImages}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-500 disabled:opacity-80"
                  >
                    {isGeneratingImages ? <><Loader2 size={16} className="animate-spin" /> Gerando Pixels...</> : 'Acionar IA de Imagens'}
                  </button>
                </div>
              )}
           </div>

           {/* Step 5: Finished */}
           <div className={`p-6 rounded-3xl border transition-all ${currentStep === 5 ? 'bg-green-900/20 border-green-500/30 shadow-lg' : 'bg-zinc-900/30 border-white/5 opacity-50'}`}>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2">
                 <Check size={16} className={currentStep === 5 ? 'text-green-400' : ''} /> 5. Pronto para Publicar
              </h3>
           </div>
         </div>

         {/* GRID PANORÂMICO DE SLIDES */}
         <div className="flex-1 bg-zinc-950/50 rounded-3xl border border-white/5 relative overflow-y-auto p-8 custom-scrollbar">
            {slides.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-white/5 rounded-2xl">
                 <ImageIcon size={48} className="mb-4 opacity-50" />
                 <p>Complete as etapas na lateral para visualizar o Grid de Slides.</p>
               </div>
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
                 {slides.map((slide, i) => (
                    // Instagram Aspect Ratio Container (4:5) in miniature form
                    <div key={i} className={`relative w-full aspect-[4/5] shadow-xl rounded-md overflow-hidden flex flex-col justify-center p-6 transition-all ring-1 ring-white/10 ${getTemplateClasses(i)}`}>
                       
                       {/* Header Fake Insta Penequeno */}
                       <div className="absolute top-0 left-0 w-full p-3 flex items-center justify-between opacity-60">
                          <div className="flex items-center gap-1.5">
                             <div className={`w-5 h-5 rounded-full border ${activeTemplate === 'noticiario' ? 'bg-zinc-200 border-black/20' : 'bg-slate-400 border-white/20'}`} />
                             <span className={`text-[10px] font-bold ${activeTemplate === 'noticiario' ? 'text-black' : 'text-white'}`}>voce_aqui</span>
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${activeTemplate === 'noticiario' ? 'bg-black/10 text-black' : 'bg-black/40 text-white'}`}>
                             {i + 1}/{slides.length}
                          </span>
                       </div>

                       {/* Template Image Injection Spots */}
                       {slide.mock_image && activeTemplate === 'minimalista' && (
                          <div className="mb-4 w-24 h-24 mx-auto border-2 border-brand/50 rounded-full overflow-hidden shrink-0 shadow-[0_0_15px_rgba(242,47,29,0.3)]">
                            <img src={slide.mock_image} className="w-full h-full object-cover" alt="AI Gen" />
                          </div>
                       )}

                       {slide.mock_image && activeTemplate === 'criador' && (
                          <div className="absolute inset-0 z-0 opacity-40 mix-blend-overlay">
                            <img src={slide.mock_image} className="w-full h-full object-cover" alt="AI Gen Bg" />
                          </div>
                       )}

                       {slide.mock_image && activeTemplate === 'noticiario' && (
                          <div className="mb-4 w-full h-32 bg-zinc-200 overflow-hidden shrink-0">
                            <img src={slide.mock_image} className="w-full h-full object-cover filter grayscale" alt="AI Gen News" />
                          </div>
                       )}

                       {/* Slide Text */}
                       {/* O Text é limpo para caber melhor na miniatura se precisar, mas mantemos cru por enquanto */}
                       <h2 className={`text-base font-extrabold tracking-tight leading-snug drop-shadow-sm z-10 ${activeTemplate === 'noticiario' ? 'text-zinc-900 border-l-4 border-brand pl-3' : ''}`}>
                          {slide.copy_text.replace(/SLIDE \d+:/, '').trim()}
                       </h2>

                       {/* Placeholder Element se não tem imagem gerada */}
                       {!slide.mock_image && ['minimalista', 'noticiario'].includes(activeTemplate) && (
                         <div className="mt-4 border border-dashed border-white/20 w-16 h-16 mx-auto rounded-lg flex items-center justify-center opacity-30">
                           <ImageIcon size={16} />
                         </div>
                       )}
                    </div>
                 ))}
               </div>
            )}
         </div>

      </div>
    </div>
  );
}
