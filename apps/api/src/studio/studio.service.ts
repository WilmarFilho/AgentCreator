import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabse/supabase.service';
import { OpenaiService } from '../openai/openai.service';
import { NewsService } from './news.service';
import { NormalizedPersona, TrendSuggestion } from './studio.types';

@Injectable()
export class StudioService {
  private readonly logger = new Logger(StudioService.name);

  constructor(
    private supabase: SupabaseService,
    private openai: OpenaiService,
    private news: NewsService,
  ) { }

  async getTrendsForProfile(profileId: string) {
    const sbClient = this.supabase.getClient();
    const cacheBoundary = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Check if we already have recent suggestions for the last 24h
    const { data: existingTrends, error: errFetch } = await sbClient
      .from('trend_topics')
      .select('*')
      .eq('profile_id', profileId)
      .eq('status', 'suggested')
      .gte('created_at', cacheBoundary)
      .order('created_at', { ascending: false })
      .limit(10);

    if (errFetch) {
      this.logger.warn(`Failed to fetch cached trends: ${errFetch.message}`);
    }

    if (existingTrends && existingTrends.length >= 10) {
      return existingTrends.slice(0, 10);
    }

    // 2. Fetch the Brand Persona
    const persona = await this.getLatestPersona(profileId);

    // 3. Gather recent news and produce tailored trends
    const articles = await this.news.getRecentNewsForPersona(persona);
    const curatedArticles = articles.length > 0
      ? await this.openai.selectRelevantNewsArticles(persona, articles)
      : [];
    const newTrends = curatedArticles.length > 0
      ? await this.openai.generateNewsBackedTrends(persona, curatedArticles)
      : await this.openai.generateTrends(persona);

    if (newTrends.length === 0) {
      return [];
    }

    // 4. Save to DB
    const insertData = newTrends.slice(0, 10).map((t: TrendSuggestion) => {
      const originalArticle = articles.find(a => a.link === t.sourceUrl || a.sourceUrl === t.sourceUrl);
      const fullCaption = originalArticle ? originalArticle.summary : t.summary;

      return {
        profile_id: profileId,
        source: t.source,
        source_url: t.sourceUrl,
        topic_title: t.title,
        context_summary: fullCaption,
        published_at: new Date().toISOString(),
        source_type: 'news',
        relevance_score: Math.round(t.relevanceScore || 85),
      };
    });

    const { data: inserted, error: insertError } = await sbClient
      .from('trend_topics')
      .insert(insertData)
      .select('*');

    if (insertError) {
      this.logger.error('Failed to save trend_topics', insertError);
      throw new HttpException('Database error saving trends', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return (inserted || []).slice(0, 10);
  }

  async generateCopyPreview(profileId: string, topicId: string) {
    if (!profileId || !topicId) {
      throw new HttpException('profileId and topicId are required', HttpStatus.BAD_REQUEST);
    }

    const sbClient = this.supabase.getClient();

    // 1. Check if we already have a cached copy
    const { data: cachedCarousel, error: carouselError } = await sbClient
      .from('generated_carousels')
      .select('*, carousel_slides(*)')
      .eq('trend_topic_id', topicId)
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cachedCarousel) {
      this.logger.log(`Found cached copy for topic ${topicId}`);
      return {
        main_caption: cachedCarousel.main_caption || '',
        slides: cachedCarousel.carousel_slides
          .sort((a: any, b: any) => a.slide_order - b.slide_order)
          .map((slide: any) => ({
            order: slide.slide_order,
            copy_text: slide.copy_text,
            ai_image_prompt: slide.ai_image_prompt,
          })),
      };
    }

    const persona = await this.getLatestPersona(profileId);

    // Fetch objectives and competitor analysis
    const { data: objectives } = await sbClient
      .from('creator_objectives')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .maybeSingle();

    let competitorAnalysisStr = '';
    if (objectives && objectives.competitors) {
      const cmpKey = objectives.competitors.trim();
      if (cmpKey.length > 0) {
        // Check cache in competitor_analyses
        const { data: cached } = await sbClient
          .from('competitor_analyses')
          .select('analysis_text')
          .eq('profile_id', profileId)
          .eq('competitors_text', cmpKey)
          .maybeSingle();

        if (cached && cached.analysis_text) {
          competitorAnalysisStr = cached.analysis_text;
        } else {
          this.logger.warn(`Competitor analysis for ${cmpKey} not found in cache. Continuing without competitor context.`);
        }
      }
    }

    const { data: topic, error: topicError } = await sbClient
      .from('trend_topics')
      .select('*')
      .eq('id', topicId)
      .eq('profile_id', profileId)
      .single();

    if (topicError || !topic) {
      throw new HttpException('Trend topic not found', HttpStatus.NOT_FOUND);
    }

    // 2. The entire 'news' is actually the full Instagram caption stored in context_summary
    const promptTopic = [
      `Titulo: ${topic.topic_title}`,
      `LEGENDA COMPLETA DO POST DA NOTÍCIA (USE COMO TEXTO FONTE):\n${topic.context_summary}`,
      `Fonte: ${topic.source || 'Instagram @notjournal.ai'}`,
      topic.published_at ? `Data da noticia: ${topic.published_at}` : null,
      topic.source_url ? `Link da noticia: ${topic.source_url}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const previewContext = [
      'Template Layout: Draft editorial para preview do Estudio.',
      'Entregue um roteiro forte para carrossel com no maximo 6 slides.',
      'Priorize hooks curtos, ritmo de leitura alto e fechamento com CTA estratégico.',
      'Cada slide deve funcionar isoladamente e tambem empurrar para o proximo.',
      'Mergulhe DEEP no texto fonte (a legenda que contém a notícia). Extraia os fatos cruciais textuais.',
      'Cruze os fatos da noticia com as dores, concorrentes e questoes psicologicas da persona.',
      'Evite formula pronta e frases vazias de efeito genéricas.',
    ].join(' ');

    const result = await this.openai.generateCarousel(promptTopic, previewContext, persona, objectives, competitorAnalysisStr);

    // 3. Save to DB for future caching
    const { data: newCarousel, error: insertCarouselErr } = await sbClient
      .from('generated_carousels')
      .insert({
        profile_id: profileId,
        trend_topic_id: topicId,
        main_caption: result.main_caption,
        status: 'draft',
      })
      .select('id')
      .single();

    if (!insertCarouselErr && newCarousel) {
      const slidesData = result.slides.map(slide => ({
        carousel_id: newCarousel.id,
        slide_order: slide.order,
        copy_text: slide.copy_text,
        ai_image_prompt: slide.ai_image_prompt,
      }));
      await sbClient.from('carousel_slides').insert(slidesData);
    } else {
      this.logger.warn(`Failed to cache generated carousel: ${insertCarouselErr?.message}`);
    }

    return result;
  }

  private async getLatestPersona(profileId: string): Promise<NormalizedPersona> {
    const sbClient = this.supabase.getClient();
    const { data: persona } = await sbClient
      .from('brand_personas')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .single();

    if (!persona) {
      throw new HttpException('Brand Persona not found. Please run Raio-X first.', HttpStatus.BAD_REQUEST);
    }

    return {
      ...persona,
      nicho_principal: persona.nicho_principal || persona.content_niche || 'Criador de conteúdo',
      subnichos: Array.isArray(persona.subnichos) ? persona.subnichos : [],
      pontos_fortes: Array.isArray(persona.pontos_fortes) ? persona.pontos_fortes : [],
      pontos_fracos: Array.isArray(persona.pontos_fracos) ? persona.pontos_fracos : [],
      fator_viralizacao: Number(persona.fator_viralizacao) || 0,
      publico_alvo: persona.publico_alvo || 'Público geral',
      posicionamento: persona.posicionamento || persona.tone_of_voice || '',
      resumo_psicologico: persona.resumo_psicologico || persona.psychological_profile || '',
    };
  }
}
