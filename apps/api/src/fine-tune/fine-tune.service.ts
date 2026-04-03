import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';
import { OpenaiService } from '../openai.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FineTuneService {
  private readonly logger = new Logger(FineTuneService.name);

  constructor(
    private supabase: SupabaseService,
    private openai: OpenaiService,
  ) {}

  /**
   * Generates a dataset for fine-tuning based on completed Raio-X profiles.
   */
  async generateJsonlDataset(): Promise<string> {
    const sbClient = this.supabase.getClient();
    this.logger.log('Fetching approved Brand Personas for dataset generation...');

    // Get all calculated personas (the correct output we want the AI to learn to generate)
    const { data: personas, error: personaError } = await sbClient
      .from('brand_personas')
      .select('*')
      .order('created_at', { ascending: false });

    if (personaError || !personas) {
      throw new Error('Failed to fetch personas from DB: ' + personaError?.message);
    }

    let jsonlContent = '';

    const SYSTEM_PROMPT = `Você é um analista especialista de marketing e perfil de criadores. Use os dados brutos de posts extraídos para gerar o Raio-X da brand persona em JSON válido contendo: nicho_principal, subnichos, pontos_fortes, pontos_fracos, fator_viralizacao, resumo_psicologico, publico_alvo e posicionamento.`;

    // Para cada persona, vamos buscar o "Input" q resultou na persona.
    // O input é composto por todas as analises em post_content_analysis 
    for (const persona of personas) {
      const profileId = persona.profile_id;
      
      const { data: rawContents } = await sbClient
        .from('post_content_analysis')
        .select('*')
        .eq('profile_id', profileId);

      if (!rawContents || rawContents.length === 0) continue;

      // Monta o "DeepContentPayload" em texto/JSON resumido que seria o imput real
      const inputPayload = {
        captions: rawContents.filter(c => c.content_type === 'caption').map(c => c.content_text),
        imageAnalyses: rawContents.filter(c => c.content_type === 'image_analysis').map(c => c.content_text),
        videoTranscriptions: rawContents.filter(c => c.content_type === 'video_transcription').map(c => c.content_text),
      };

      const expectedOutput = {
        nicho_principal: persona.content_niche,
        subnichos: persona.subnichos,
        pontos_fortes: persona.pontos_fortes,
        pontos_fracos: persona.pontos_fracos,
        fator_viralizacao: persona.fator_viralizacao,
        resumo_psicologico: persona.psychological_profile,
        publico_alvo: persona.publico_alvo,
        posicionamento: persona.tone_of_voice
      };

      const messageObj = {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(inputPayload) },
          { role: 'assistant', content: JSON.stringify(expectedOutput) }
        ]
      };

      jsonlContent += JSON.stringify(messageObj) + '\n';
    }

    return jsonlContent;
  }

  async triggerOpenAIFineTune() {
    this.logger.log('Start training not fully automated yet. Use export-jsonl and upload via OpenAI platform for phase 3.');
    return { status: 'pending', message: 'Download the dataset from /fine-tune/export-jsonl and upload it to platform.openai.com/finetune' };
  }
}
