'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Loader2,
  Search,
  Sparkles,
  Wand2,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type SavedCopy = {
  id: string;
  title: string;
  copy?: string;
  main_caption?: string;
  slides?: Array<{ order: number; copy_text: string; ai_image_prompt?: string }>;
};

type WorkingSlide = {
  order: number;
  copy_text: string;
  ai_image_prompt: string;
  imageUrl: string | null;
  refs: Array<{ query: string; url: string }>;
  loadingImage: boolean;
  loadingRefs: boolean;
};

type TemplateId = 'editorial-dark' | 'editorial-light' | 'cover-story';

const templates: Array<{ id: TemplateId; name: string; description: string }> = [
  { id: 'editorial-dark', name: 'Editorial Dark', description: 'Fundo escuro, headline densa e bloco de imagem premium.' },
  { id: 'editorial-light', name: 'Editorial Light', description: 'Leitura clara, destaques em laranja e nota analítica.' },
  { id: 'cover-story', name: 'Cover Story', description: 'Capa forte com imagem dominante e headline de impacto.' },
];

function cleanText(text: string) {
  return text.replace(/SLIDE\s+\d+:\s*/i, '').trim();
}

function buildSlides(copy: SavedCopy | null): WorkingSlide[] {
  if (!copy) return [];
  const source = Array.isArray(copy.slides) && copy.slides.length > 0
    ? copy.slides
    : (copy.copy || '')
        .split('\n\n')
        .filter(Boolean)
        .map((chunk, index) => ({ order: index + 1, copy_text: chunk, ai_image_prompt: cleanText(chunk) }));

  return source.map((slide, index) => ({
    order: slide.order || index + 1,
    copy_text: cleanText(slide.copy_text || ''),
    ai_image_prompt: slide.ai_image_prompt || cleanText(slide.copy_text || ''),
    imageUrl: null,
    refs: [],
    loadingImage: false,
    loadingRefs: false,
  }));
}

function splitText(text: string) {
  const cleaned = cleanText(text);
  const parts = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  return { headline: parts[0] || cleaned, body: parts.slice(1).join(' ') || cleaned };
}

function accentText(text: string) {
  return text.split(/(R\$\s?\d[\d.,]*|\d+(?:,\d+)?%|\d+\s?(?:mil|milhões)|TikTok Shop|Instagram|CEO|Brasil)/gi).map((part, index) => {
    const accent = /(R\$\s?\d[\d.,]*|\d+(?:,\d+)?%|\d+\s?(?:mil|milhões)|TikTok Shop|Instagram|CEO|Brasil)/i.test(part);
    return <span key={`${part}-${index}`} className={accent ? 'text-[#ff5a1f]' : ''}>{part}</span>;
  });
}

export default function FactoryStudio() {
  const [savedCopies, setSavedCopies] = useState<SavedCopy[]>([]);
  const [activeCopyId, setActiveCopyId] = useState<string | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<TemplateId>('editorial-dark');
  const [slides, setSlides] = useState<WorkingSlide[]>([]);
  const [caption, setCaption] = useState('');
  const [loadingAllImages, setLoadingAllImages] = useState(false);
  const [loadingAllRefs, setLoadingAllRefs] = useState(false);

  useEffect(() => {
    const copies = JSON.parse(localStorage.getItem('saved_copies') || '[]') as SavedCopy[];
    const active = localStorage.getItem('mock_copy_active');
    const activeCopy = active ? JSON.parse(active) as SavedCopy : null;
    const merged = activeCopy && !copies.find((item) => item.id === activeCopy.id) ? [activeCopy, ...copies] : copies;
    setSavedCopies(merged);
    setActiveCopyId(activeCopy?.id || merged[0]?.id || null);
  }, []);

  const activeCopy = useMemo(
    () => savedCopies.find((copy) => copy.id === activeCopyId) || null,
    [savedCopies, activeCopyId],
  );

  const applyCopy = () => {
    setSlides(buildSlides(activeCopy));
    setCaption(activeCopy?.main_caption || '');
  };

  const patchSlide = (order: number, patch: Partial<WorkingSlide>) => {
    setSlides((current) => current.map((slide) => (slide.order === order ? { ...slide, ...patch } : slide)));
  };

  const fetchImage = async (slide: WorkingSlide) => {
    patchSlide(slide.order, { loadingImage: true });
    try {
      const response = await fetch(`${API_URL}/api/factory/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: slide.ai_image_prompt || slide.copy_text, templateStyle: activeTemplate }),
      });
      const data = await response.json();
      patchSlide(slide.order, { imageUrl: data.imageUrl || null, loadingImage: false });
    } catch {
      patchSlide(slide.order, { loadingImage: false });
    }
  };

  const fetchRefs = async (slide: WorkingSlide) => {
    patchSlide(slide.order, { loadingRefs: true });
    try {
      const response = await fetch(`${API_URL}/api/factory/pinterest-references`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: slide.ai_image_prompt || slide.copy_text, templateStyle: activeTemplate }),
      });
      const data = await response.json();
      patchSlide(slide.order, { refs: Array.isArray(data.results) ? data.results : [], loadingRefs: false });
    } catch {
      patchSlide(slide.order, { loadingRefs: false });
    }
  };

  const fetchAllImages = async () => {
    setLoadingAllImages(true);
    for (const slide of slides) await fetchImage(slide);
    setLoadingAllImages(false);
  };

  const fetchAllRefs = async () => {
    setLoadingAllRefs(true);
    for (const slide of slides) await fetchRefs(slide);
    setLoadingAllRefs(false);
  };

  const renderCard = (slide: WorkingSlide) => {
    const { headline, body } = splitText(slide.copy_text);
    if (activeTemplate === 'cover-story') {
      return (
        <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-[#09090f] shadow-2xl">
          {slide.imageUrl ? <img src={slide.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,0.2),transparent_35%),linear-gradient(180deg,#1b1b25,#09090f)]" />}
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/85" />
          <div className="relative flex h-full flex-col justify-between p-5 text-white">
            <div className="flex justify-between text-[10px] uppercase tracking-[0.18em] text-white/70"><span>Powered by AgentCreator</span><span>2026 //</span></div>
            <h2 className="text-[2rem] font-black uppercase leading-[0.92] tracking-[-0.05em]">{accentText(headline)}</h2>
          </div>
        </div>
      );
    }

    const light = activeTemplate === 'editorial-light';
    return (
      <div className={`aspect-[4/5] overflow-hidden rounded-[28px] border ${light ? 'border-black/10 bg-[#f4f0ea] text-[#111]' : 'border-white/5 bg-[#070710] text-[#f6f0e8]'} shadow-2xl`}>
        <div className="flex h-full flex-col p-5">
          <div className={`mb-4 flex justify-between text-[10px] uppercase tracking-[0.18em] ${light ? 'text-black/55' : 'text-white/55'}`}><span>Powered by AgentCreator</span><span>@branddecoded_</span><span>2026 //</span></div>
          <h2 className="text-[1.95rem] font-black leading-[1.02] tracking-[-0.05em]">{accentText(headline)}</h2>
          <div className={`my-4 overflow-hidden rounded-[18px] ${light ? 'bg-[#ddd6ce]' : 'bg-white/8'}`}>
            {slide.imageUrl ? <img src={slide.imageUrl} alt="" className="h-52 w-full object-cover" /> : <div className={`flex h-52 items-center justify-center ${light ? 'bg-[linear-gradient(135deg,#e6dfd6,#c7beb2)] text-black/25' : 'bg-[linear-gradient(135deg,#1b1b25,#303040)] text-white/25'}`}><ImageIcon size={34} /></div>}
          </div>
          <p className="text-[1.08rem] font-semibold leading-[1.16]">{accentText(body)}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-80px)] max-w-[1650px] flex-col py-6">
      <div className="mb-6 flex items-center justify-between border-b border-white/5 pb-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/studio" className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/5"><ArrowLeft size={24} /></Link>
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold text-white"><Layers className="text-brand" /> Fábrica de Carrossel Editorial</h1>
            <p className="text-sm text-slate-400">Template inspirado nas referências anexadas com imagem IA e buscas visuais.</p>
          </div>
        </div>
        <button disabled={!slides.some((slide) => slide.imageUrl)} className="flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 font-bold text-white disabled:opacity-50"><Download size={18} /> Exportar Lote</button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-8 lg:flex-row">
        <div className="custom-scrollbar w-full shrink-0 overflow-y-auto pr-2 lg:w-[390px]">
          <div className="space-y-5">
            <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
              <div className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-300">Copy</div>
              <div className="space-y-3">
                {savedCopies.map((copy) => (
                  <button key={copy.id} onClick={() => setActiveCopyId(copy.id)} className={`w-full rounded-2xl border p-4 text-left ${activeCopyId === copy.id ? 'border-brand bg-brand/10 text-white' : 'border-white/5 bg-black/20 text-slate-300'}`}>
                    <div className="font-semibold">{copy.title}</div>
                    <div className="mt-1 text-xs text-slate-400">{Array.isArray(copy.slides) ? `${copy.slides.length} slides` : 'Copy textual'}</div>
                  </button>
                ))}
              </div>
              <button onClick={applyCopy} disabled={!activeCopyId} className="mt-4 w-full rounded-xl bg-white/10 py-3 font-bold text-white disabled:opacity-50">Aplicar Copy</button>
            </section>

            <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
              <div className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-300">Template</div>
              <div className="space-y-3">
                {templates.map((template) => (
                  <button key={template.id} onClick={() => setActiveTemplate(template.id)} className={`w-full rounded-2xl border p-4 text-left ${activeTemplate === template.id ? 'border-brand bg-brand/10' : 'border-white/5 bg-black/20'}`}>
                    <div className="font-semibold text-white">{template.name}</div>
                    <div className="mt-1 text-xs text-slate-400">{template.description}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
              <div className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-slate-300">Imagem</div>
              <div className="grid gap-3">
                <button onClick={fetchAllImages} disabled={slides.length === 0 || loadingAllImages} className="flex items-center justify-center gap-2 rounded-xl bg-[#ff5a1f] px-4 py-3 font-bold text-white disabled:opacity-50">{loadingAllImages ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} Gerar com IA</button>
                <button onClick={fetchAllRefs} disabled={slides.length === 0 || loadingAllRefs} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-bold text-white disabled:opacity-50">{loadingAllRefs ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Pinterest</button>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.2em] text-slate-300"><Sparkles size={16} className="text-brand" /> Legenda</div>
              <textarea value={caption} onChange={(event) => setCaption(event.target.value)} className="custom-scrollbar min-h-36 w-full resize-none rounded-2xl border border-white/5 bg-black/30 p-4 text-sm text-slate-200 focus:outline-none" />
            </section>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto rounded-3xl border border-white/5 bg-zinc-950/50 p-8">
          {slides.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/10 text-slate-500"><ImageIcon size={48} className="mb-4 opacity-50" /><p>Aplique uma copy para começar.</p></div>
          ) : (
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3">
                {slides.map((slide) => (
                  <div key={slide.order} className="space-y-4">
                    {renderCard(slide)}
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                      <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Slide {slide.order}</div>
                      <textarea value={slide.copy_text} onChange={(event) => patchSlide(slide.order, { copy_text: event.target.value })} className="custom-scrollbar min-h-28 w-full resize-none bg-transparent text-sm leading-relaxed text-slate-200 focus:outline-none" />
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                      <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Prompt Visual</div>
                      <textarea value={slide.ai_image_prompt} onChange={(event) => patchSlide(slide.order, { ai_image_prompt: event.target.value })} className="custom-scrollbar min-h-24 w-full resize-none bg-transparent text-sm leading-relaxed text-slate-300 focus:outline-none" />
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <button onClick={() => fetchImage(slide)} disabled={slide.loadingImage} className="flex items-center justify-center gap-2 rounded-xl bg-[#ff5a1f] px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">{slide.loadingImage ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} Gerar IA</button>
                        <button onClick={() => fetchRefs(slide)} disabled={slide.loadingRefs} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">{slide.loadingRefs ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Pinterest</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <aside className="space-y-5">
                <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6">
                  <div className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-slate-300">Referências Visuais</div>
                  <p className="mb-4 text-sm text-slate-400">Os links abaixo abrem buscas prontas no Pinterest com base no prompt de cada slide.</p>
                  <div className="space-y-4">
                    {slides.map((slide) => (
                      <div key={`refs-${slide.order}`} className="rounded-2xl border border-white/5 bg-black/20 p-4">
                        <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Slide {slide.order}</div>
                        {slide.refs.length === 0 ? <p className="text-sm text-slate-500">Gere referências para este slide.</p> : (
                          <div className="space-y-2">
                            {slide.refs.map((ref) => (
                              <a key={`${slide.order}-${ref.query}`} href={ref.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
                                <span>{ref.query}</span>
                                <ExternalLink size={14} className="text-slate-400" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
