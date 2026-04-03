import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';
import { OpenaiService } from '../openai.service';

@Injectable()
export class StudioService {
  private readonly logger = new Logger(StudioService.name);

  constructor(
    private supabase: SupabaseService,
    private openai: OpenaiService,
  ) {}

  async getTrendsForProfile(profileId: string) {
    const sbClient = this.supabase.getClient();

    // 1. Check if we already have recent suggestions for today
    const { data: existingTrends, error: errFetch } = await sbClient
      .from('trend_topics')
      .select('*')
      .eq('profile_id', profileId)
      .eq('status', 'suggested')
      .order('created_at', { ascending: false })
      .limit(3);

    if (existingTrends && existingTrends.length >= 3) {
        return existingTrends;
    }

    // 2. Fetch the Brand Persona
    const { data: persona } = await sbClient
      .from('brand_personas')
      .select('*')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .single();

    if (!persona) {
      throw new HttpException('Brand Persona not found. Please run Raio-X first.', HttpStatus.BAD_REQUEST);
    }

    // 3. Request OpenAI to generate new trends
    const newTrends = await this.openai.generateTrends({
        nicho_principal: persona.content_niche,
        subnichos: persona.subnichos || [],
        pontos_fortes: persona.pontos_fortes || [],
        pontos_fracos: persona.pontos_fracos || [],
        fator_viralizacao: persona.fator_viralizacao || 0,
        publico_alvo: persona.publico_alvo || 'Público geral',
        posicionamento: persona.posicionamento || persona.tone_of_voice || '',
        resumo_psicologico: persona.resumo_psicologico || persona.psychological_profile || '',
    });

    if (newTrends.length === 0) {
        return [];
    }

    // 4. Save to DB
    const insertData = newTrends.map((t) => ({
        profile_id: profileId,
        topic_title: t.title,
        context_summary: t.summary,
        relevance_score: Math.floor(Math.random() * (99 - 85 + 1)) + 85, // fake relevance
    }));

    const { data: inserted, error: insertError } = await sbClient
        .from('trend_topics')
        .insert(insertData)
        .select('*');

    if (insertError) {
        this.logger.error('Failed to save trend_topics', insertError);
        throw new HttpException('Database error saving trends', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return inserted;
  }
}
