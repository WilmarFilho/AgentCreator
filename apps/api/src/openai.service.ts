import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { toFile } from 'openai';

export interface PersonaResult {
  primary_goal: 'sales' | 'authority' | 'growth';
  content_niche: string;
  tone_of_voice: string;
  psychological_profile: string;
  visual_preferences: Record<string, string>;
}

export interface DeepContentPayload {
  captions: string[];
  imageAnalyses: string[];
  videoTranscriptions: string[];
}

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name);
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }

  // ─── VISION: Analyze an Instagram post image ─────────────────────────
  async analyzeImage(imageUrl: string, imageBuffer?: Buffer): Promise<string> {
    this.logger.debug(`Analyzing image with GPT-4o Vision...`);
    try {
      // Download image and convert to base64 (Instagram CDN URLs are temporary and OpenAI can't access them)
      let base64Data: string;
      if (imageBuffer) {
        base64Data = imageBuffer.toString('base64');
      } else {
        const axios = (await import('axios')).default;
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
        });
        base64Data = Buffer.from(response.data).toString('base64');
      }

      const dataUri = `data:image/jpeg;base64,${base64Data}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Você é um analista especialista de conteúdo para Instagram. Analise a imagem do post e descreva em detalhes:
1. O que aparece na imagem (pessoas, objetos, cenário, texto overlay)
2. O estilo visual (cores dominantes, filtros, composição, iluminação)
3. O tipo de conteúdo (educativo, lifestyle, produto, bastidores, motivacional, etc.)
4. A mensagem/intenção por trás da imagem
5. Qualidade percebida (amador, semi-profissional, profissional)

Responda em Português Brasileiro de forma estruturada e concisa (máximo 300 palavras).`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: dataUri, detail: 'low' },
              },
            ],
          },
        ],
        max_tokens: 500,
      });

      return response.choices[0]?.message?.content || 'Análise não disponível';
    } catch (error: any) {
      this.logger.error(`Failed to analyze image: ${error.message}`);
      return `Erro ao analisar imagem: ${error.message}`;
    }
  }

  // ─── WHISPER: Transcribe audio from video ─────────────────────────────
  async transcribeAudio(audioBuffer: Buffer, filename: string = 'audio.mp3'): Promise<string> {
    this.logger.debug(`Transcribing audio (${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB)...`);
    try {
      const file = await toFile(audioBuffer, filename, { type: 'audio/mpeg' });

      const transcription = await this.openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language: 'pt',
        response_format: 'text',
      });

      this.logger.debug(`Transcription complete: ${(transcription as string).substring(0, 100)}...`);
      return transcription as string;
    } catch (error: any) {
      this.logger.error(`Failed to transcribe audio: ${error.message}`);
      return `Erro na transcrição: ${error.message}`;
    }
  }

  // ─── EMBEDDINGS: Generate vector embedding for RAG ────────────────────
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Truncate to ~8000 tokens (~32k chars) to stay within model limits
      const truncated = text.substring(0, 30000);

      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: truncated,
      });

      return response.data[0].embedding;
    } catch (error: any) {
      this.logger.error(`Failed to generate embedding: ${error.message}`);
      throw error;
    }
  }

  // ─── BATCH EMBEDDINGS: Generate multiple embeddings at once ────────────
  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    try {
      const truncated = texts.map(t => t.substring(0, 30000));

      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: truncated,
      });

      return response.data.map(d => d.embedding);
    } catch (error: any) {
      this.logger.error(`Failed to generate batch embeddings: ${error.message}`);
      throw error;
    }
  }

  // ─── DEEP PERSONA: Analyze using ALL content types ────────────────────
  async analyzePersonaDeep(content: DeepContentPayload): Promise<PersonaResult> {
    this.logger.log('Analyzing persona with DEEP analysis (captions + images + videos)...');

    // ── Token budget management ──
    // GPT-4o TPM limit is 30k. System prompt ~600 tokens, response 4k tokens.
    // So we budget ~20k tokens for user content (~80k chars / 4 chars per token).
    const MAX_CONTENT_CHARS = 20000;
    const MAX_ITEM_CHARS = 800; // Max chars per individual item

    // Sample and truncate each content type proportionally
    const truncateItem = (text: string) =>
      text.length > MAX_ITEM_CHARS ? text.substring(0, MAX_ITEM_CHARS) + '...' : text;

    // Prioritize: captions (most important), then videos, then images
    const maxCaptions = Math.min(content.captions.length, 15);
    const maxVideos = Math.min(content.videoTranscriptions.length, 5);
    const maxImages = Math.min(content.imageAnalyses.length, 20);

    const sampledCaptions = content.captions.slice(0, maxCaptions).map(truncateItem);
    const sampledVideos = content.videoTranscriptions.slice(0, maxVideos).map(truncateItem);
    const sampledImages = content.imageAnalyses.slice(0, maxImages).map(truncateItem);

    if (content.captions.length > maxCaptions || content.imageAnalyses.length > maxImages || content.videoTranscriptions.length > maxVideos) {
      this.logger.warn(
        `Content truncated for persona analysis: captions ${content.captions.length}→${sampledCaptions.length}, ` +
        `images ${content.imageAnalyses.length}→${sampledImages.length}, ` +
        `videos ${content.videoTranscriptions.length}→${sampledVideos.length}`
      );
    }

    const sections: string[] = [];

    if (sampledCaptions.length > 0) {
      sections.push(`## LEGENDAS DOS POSTS (${sampledCaptions.length}/${content.captions.length} posts)\n${sampledCaptions.join('\n---\n')}`);
    }

    if (sampledImages.length > 0) {
      sections.push(`## ANÁLISES VISUAIS DAS IMAGENS (${sampledImages.length}/${content.imageAnalyses.length} imagens)\n${sampledImages.join('\n---\n')}`);
    }

    if (sampledVideos.length > 0) {
      sections.push(`## TRANSCRIÇÕES DE VÍDEOS/REELS (${sampledVideos.length}/${content.videoTranscriptions.length} vídeos)\n${sampledVideos.join('\n---\n')}`);
    }

    let fullContent = sections.join('\n\n');

    // Final safety net: hard truncate if still too long
    if (fullContent.length > MAX_CONTENT_CHARS) {
      this.logger.warn(`Content still too long (${fullContent.length} chars), hard truncating to ${MAX_CONTENT_CHARS}`);
      fullContent = fullContent.substring(0, MAX_CONTENT_CHARS) + '\n\n[...conteúdo truncado por limite de tokens]';
    }

    this.logger.debug(`Persona analysis content size: ${fullContent.length} chars (~${Math.ceil(fullContent.length / 4)} tokens)`);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Você é um estrategista de marketing digital de elite, especialista em branding pessoal e análise comportamental de criadores de conteúdo.

Você receberá uma amostra representativa do conteúdo de um perfil do Instagram, incluindo:
- Legendas dos posts
- Análises visuais das imagens (feitas por IA)
- Transcrições de vídeos/reels

Com base em TUDO isso, defina a Brand Persona desse criador de conteúdo.

IMPORTANTE: Todos os valores no JSON devem ser escritos em Português Brasileiro (pt-BR), exceto as chaves JSON que devem permanecer em inglês.

Sua análise deve ser PROFUNDA e DETALHADA. Não seja genérico. Use exemplos específicos do conteúdo analisado para justificar cada aspecto da persona.

Responda APENAS com um JSON válido seguindo esta estrutura:
{
  "primary_goal": "sales" | "authority" | "growth",
  "content_niche": "descrição detalhada do nicho e sub-nichos (pt-BR, mínimo 100 palavras)",
  "tone_of_voice": "descrição rica do tom de voz com exemplos de padrões linguísticos encontrados (pt-BR, mínimo 100 palavras)",
  "psychological_profile": "perfil psicológico profundo da marca/criador, incluindo arquétipos, valores centrais, gatilhos emocionais usados, e padrão de comunicação (pt-BR, mínimo 150 palavras)",
  "visual_preferences": {
    "colors": "paleta de cores dominante identificada nos posts (pt-BR)",
    "style": "estilo visual predominante com detalhes (pt-BR)",
    "photo_quality": "nível de qualidade e consistência visual (pt-BR)",
    "content_formats": "formatos mais usados e preferidos (pt-BR)",
    "visual_identity_score": "nota de 1 a 10 para consistência da identidade visual"
  }
}`,
          },
          {
            role: 'user',
            content: `Analise o seguinte conteúdo do perfil:\n\n${fullContent}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      });

      const parsed: PersonaResult = JSON.parse(response.choices[0]?.message?.content || '{}');
      return parsed;
    } catch (error) {
      this.logger.error('Error in deep persona analysis', error);
      throw error;
    }
  }

  // ─── LEGACY: Simple persona analysis (kept for backwards compat) ──────
  async analyzePersona(posts: string[]): Promise<PersonaResult> {
    this.logger.log('Analyzing persona based on posts (legacy mode)...');
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert AI marketing strategist. Based on the user's latest Instagram posts, you must determine their Brand Persona. 
IMPORTANT: ALL values in the JSON output must be written in Brazilian Portuguese (pt-BR), except for the JSON keys which must remain exactly as specified in English.
Respond ONLY with a valid JSON format following this exact structure:
{
  "primary_goal": "sales" | "authority" | "growth",
  "content_niche": "string describing their niche (in pt-BR)",
  "tone_of_voice": "string describing tone (in pt-BR)",
  "psychological_profile": "string describing the psychology of the brand (in pt-BR)",
  "visual_preferences": { "colors": "string (in pt-BR)", "style": "string (in pt-BR)" }
}`,
          },
          {
            role: 'user',
            content: `Here are the latest captions and extracted texts from my posts:\n${posts.join('\n\n')}`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content returned from OpenAI');
      }

      const parsed: PersonaResult = JSON.parse(content);
      return parsed;
    } catch (error) {
      this.logger.error('Error analyzing persona', error);
      throw error;
    }
  }

  async generateTrends(persona: PersonaResult): Promise<Array<{ title: string; summary: string }>> {
    this.logger.log('Generating trending topics based on persona: ' + persona.content_niche);
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an AI trend analyzer. Based on the following user persona, suggest 3 highly viral and relevant content ideas (news, trends, or controversial hooks) they should post about right now as an Instagram Carousel.
IMPORTANT: ALL text content inside the JSON values must be translated to and written in Brazilian Portuguese (pt-BR).
Respond ONLY with a valid JSON format following this exact structure:
{
  "trends": [
    {
      "title": "Short Hook/Headline (in pt-BR)",
      "summary": "1-2 sentence explanation of why this is relevant now or what the angle is (in pt-BR)"
    }
  ]
}`,
          },
          {
            role: 'user',
            content: `Persona Context:\nNiche: ${persona.content_niche}\nGoal: ${persona.primary_goal}\nTone: ${persona.tone_of_voice}`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No content');
      
      const parsed = JSON.parse(content);
      return parsed.trends || [];
    } catch (error) {
      this.logger.error('Error generating trends', error);
      return [];
    }
  }

  async generateCarousel(topic: string, templateContext: string, persona: PersonaResult): Promise<any> {
    this.logger.log(`Generating carousel content for topic: ${topic}`);
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a world-class Instagram copywriter. Create a 5-10 slide carousel script about the provided topic.
The template context defines the visual style, make sure the text fits that style.
IMPORTANT: The 'main_caption' and 'copy_text' MUST be written in Brazilian Portuguese (pt-BR). The 'ai_image_prompt' should remain in English to be used with Midjourney.
Respond ONLY with a valid JSON format following this exact structure:
{
  "main_caption": "The Instagram caption to go along with the post, including hashtags (in pt-BR)",
  "slides": [
    {
      "order": 1,
      "copy_text": "The exact text to appear on the slide (in pt-BR)",
      "ai_image_prompt": "A prompt to generate an evocative background image for this slide based on the text (midjourney style, in English)"
    }
  ]
}`,
          },
          {
            role: 'user',
            content: `Topic:\n${topic}\n\nPersona Context:\nNiche: ${persona.content_niche}\nTone: ${persona.tone_of_voice}\n\nTemplate Context:\n${templateContext}`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No content');
      
      return JSON.parse(content);
    } catch (error) {
      this.logger.error('Error generating carousel', error);
      throw error;
    }
  }
}
