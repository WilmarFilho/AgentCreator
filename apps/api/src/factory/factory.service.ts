import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabse/supabase.service';
import { OpenaiService } from '../openai/openai.service';

@Injectable()
export class FactoryService {
  private readonly logger = new Logger(FactoryService.name);

  constructor(
    private supabase: SupabaseService,
    private openai: OpenaiService,
  ) { }

  async generateCarousel(profileId: string, topicId: string, templateId: string) {
    if (!profileId || !topicId || !templateId) {
      throw new HttpException('Missing required parameters', HttpStatus.BAD_REQUEST);
    }
    const sbClient = this.supabase.getClient();

    // 1. Save initial draft state to database
    const { data: carousel, error: errInsert } = await sbClient
      .from('generated_carousels')
      .insert({
        profile_id: profileId,
        trend_topic_id: topicId,
        template_id: templateId,
        status: 'generating_copy' // Will notify via realtime that it's processing
      })
      .select('*')
      .single();

    if (errInsert || !carousel) {
      this.logger.error('Failed to create carousel draft', errInsert);
      throw new HttpException('Database error creating draft', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // We launch the process without waiting, MVP approach for fire-and-forget
    this.runGenerationFlow(carousel.id, profileId, topicId, templateId).catch(e => {
      this.logger.error('Async Generation Error', e);
    });

    return {
      status: 'PROCESSING',
      carouselId: carousel.id,
      message: 'A IA iniciou o processo criativo. Aguarde a sincronização.'
    };
  }

  private async runGenerationFlow(carouselId: string, profileId: string, topicId: string, templateId: string) {
    this.logger.log(`Starting Async Generation Flow for carrossel ${carouselId}...`);
    const sbClient = this.supabase.getClient();

    // 1. Fetch Context (Persona, Topic, Template)
    const [{ data: persona }, { data: topic }, { data: template }] = await Promise.all([
      sbClient.from('brand_personas').select('*').eq('profile_id', profileId).order('created_at', { ascending: false }).single(),
      sbClient.from('trend_topics').select('*').eq('id', topicId).single(),
      sbClient.from('design_templates').select('*').eq('id', templateId).single()
    ]);

    if (!persona || !topic || !template) {
      throw new Error('Missing DB context for generation (Persona, Topic or Template not found)');
    }

    // 2. Format Context for LLM
    const promptTopic = [
      `Title: ${topic.topic_title}`,
      `Context: ${topic.context_summary}`,
      topic.source ? `Source: ${topic.source}` : null,
      topic.published_at ? `Published At: ${topic.published_at}` : null,
      topic.source_url ? `Source URL: ${topic.source_url}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    const promptTemplate = `Template Layout: ${template.name}. Consider making sentences short and impactful suitable for an Instagram Carousel with multiple slides.`;

    // 3. Call OpenAI RAG
    const aiResult = await this.openai.generateCarousel(promptTopic, promptTemplate, persona);

    // 4. Update the Carousel
    await sbClient
      .from('generated_carousels')
      .update({
        main_caption: aiResult.main_caption,
        status: 'ready'
      })
      .eq('id', carouselId);

    // 5. Insert Slides
    if (aiResult.slides && Array.isArray(aiResult.slides)) {
      const slidesToInsert = aiResult.slides.map((s: any) => ({
        carousel_id: carouselId,
        slide_order: s.order || 1,
        copy_text: s.copy_text || '',
        ai_image_prompt: s.ai_image_prompt || ''
      }));
      await sbClient.from('carousel_slides').insert(slidesToInsert);
    }

    this.logger.log(`Generation for carousel ${carouselId} finished! Phase 3 step completed.`);
  }

  async getCarousel(carouselId: string) {
    const sbClient = this.supabase.getClient();
    const { data: carousel, error } = await sbClient
      .from('generated_carousels')
      .select('*, carousel_slides(*), design_templates(*)')
      .eq('id', carouselId)
      .single();

    if (error || !carousel) {
      throw new HttpException('Carousel not found', HttpStatus.NOT_FOUND);
    }

    // Sort slides
    if (carousel.carousel_slides) {
      carousel.carousel_slides.sort((a: any, b: any) => a.slide_order - b.slide_order);
    }

    return carousel;
  }

  async generateSlideImage(prompt: string, templateStyle?: string) {
    if (!prompt) {
      throw new HttpException('Prompt is required', HttpStatus.BAD_REQUEST);
    }

    return {
      imageUrl: await this.openai.generateFactoryImage(prompt, templateStyle),
    };
  }

  async getPinterestReferences(prompt: string, templateStyle?: string) {
    if (!prompt) {
      throw new HttpException('Prompt is required', HttpStatus.BAD_REQUEST);
    }

    const queries = await this.openai.generatePinterestQueries(prompt, templateStyle);

    return {
      queries,
      results: queries.map((query) => ({
        query,
        url: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`,
      })),
    };
  }
}
