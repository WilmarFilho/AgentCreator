import type { PersonaResult } from '../openai/openai.service';

export interface NormalizedPersona extends PersonaResult {
  nicho_principal: string;
  subnichos: string[];
  pontos_fortes: string[];
  pontos_fracos: string[];
  fator_viralizacao: number;
  resumo_psicologico: string;
  publico_alvo: string;
  posicionamento: string;
}

export interface NewsArticle {
  title: string;
  summary: string;
  link: string;
  source: string;
  sourceUrl?: string;
  publishedAt: string;
  relevanceReason?: string;
}

export interface TrendSuggestion {
  title: string;
  summary: string;
  source: string;
  sourceUrl?: string;
  relevanceScore: number;
}

export interface CarouselPreviewSlide {
  order: number;
  copy_text: string;
  ai_image_prompt?: string;
}

export interface CarouselPreviewResult {
  main_caption: string;
  slides: CarouselPreviewSlide[];
}

export interface CarouselAnglePlan {
  coreAngle: string;
  whyNow: string;
  audienceBridge: string;
  lesson: string;
  hookOptions: string[];
}

export interface CarouselStructurePlan {
  main_caption: string;
  slides: CarouselPreviewSlide[];
}

export interface CarouselCritique {
  strengths: string[];
  weaknesses: string[];
  missingPoints: string[];
  rewritePriorities: string[];
}

export interface CarouselRedundancyReview {
  repetitive: boolean;
  repeatedPairs: string[];
  rewriteInstructions: string[];
}
