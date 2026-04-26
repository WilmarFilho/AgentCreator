import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { toFile } from 'openai';
import {
  CarouselAnglePlan,
  CarouselCritique,
  CarouselPreviewResult,
  CarouselRedundancyReview,
  CarouselStructurePlan,
  NewsArticle,
  NormalizedPersona,
  TrendSuggestion,
} from '../studio/studio.types';

export interface CreatorObjectives {
  business_type?: string;
  target_audience?: string;
  content_goals?: string;
  monetization_strategy?: string;
  brand_values?: string;
  competitors?: string;
  extra_notes?: string;
}

export interface PersonaResult {
  nicho_principal: string;
  subnichos: string[];
  pontos_fortes: string[];
  pontos_fracos: string[];
  fator_viralizacao: number;
  resumo_psicologico: string;
  publico_alvo: string;
  posicionamento: string;
  // Fallbacks for legacy backwards compatibility
  primary_goal?: string;
  content_niche?: string;
  tone_of_voice?: string;
  psychological_profile?: string;
  visual_preferences?: Record<string, string>;
}

export interface DeepContentPayload {
  captions: string[];
  imageAnalyses: string[];
  videoTranscriptions: string[];
  metricsContext?: string;
}

export interface PinterestReferenceResult {
  queries: string[];
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

  private getFineTunedOrDefaultModel(): string {
    return process.env.FINE_TUNED_MODEL_ID || 'gpt-4o-mini';
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
        model: 'gpt-4o-mini',
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
      // Pega o ID do modelo do ENV ou usa o padrão caso não exista
      const modelToUse = process.env.FINE_TUNED_MODEL_ID || 'gpt-4o';

      // IMPORTANTE: O SYSTEM_PROMPT deve ser o mesmo usado no JSONL de treino!
      const SYSTEM_PROMPT_TRAINED = "Você é um Estrategista Senior de Growth para Instagram. Sua base de conhecimento é fundamentada nos maiores best-sellers de marketing e retenção do mundo.";

      if (process.env.FINE_TUNED_MODEL_ID) {
        this.logger.log(`🧠 USING CUSTOM FINE-TUNED LLM: ${process.env.FINE_TUNED_MODEL_ID}`);
      }

      const response = await this.openai.chat.completions.create({
        model: modelToUse,
        messages: [
          {
            role: 'system',
            content: `${SYSTEM_PROMPT_TRAINED}
            
Sua tarefa agora é analisar o conteúdo bruto de um perfil (legendas, imagens e vídeos) e gerar uma Brand Persona profunda.
Você deve utilizar sua base de conhecimento técnica (Hook Point, Contagioso, StoryBrand, etc) para avaliar o posicionamento do criador.

Responda APENAS com um JSON válido seguindo esta estrutura:
{
  "nicho_principal": "Nicho principal percebido",
  "subnichos": ["Subnicho 1", "Subnicho 2"],
  "pontos_fortes": ["Mencione teorias aplicadas corretamente pelo criador"],
  "pontos_fracos": ["Mencione falhas técnicas baseadas em marketing"],
  "fator_viralizacao": 0.0, 
  "resumo_psicologico": "Análise profunda usando arquétipos e gatilhos mentais identificados",
  "publico_alvo": "Descrição da persona consumidora",
  "posicionamento": "Tom da voz dominante"
}`,
          },
          {
            role: 'user',
            content: `CENÁRIO PARA ANÁLISE:
Engajamento: ${content.metricsContext || 'Sem dados numéricos'}

CONTEÚDO DO PERFIL:
${fullContent}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
        temperature: 0.3, // Temperatura baixa garante que ele use mais o treino e menos "criatividade" aleatória
      });

      const contentResponse = response.choices[0]?.message?.content || '{}';
      const parsed: PersonaResult = JSON.parse(contentResponse);

      return parsed;
    } catch (error) {
      this.logger.error('Error in deep persona analysis with Fine-Tuned model', error);
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

  async selectRelevantNewsArticles(
    persona: NormalizedPersona,
    articles: NewsArticle[],
  ): Promise<NewsArticle[]> {
    if (articles.length <= 6) {
      return articles;
    }

    try {
      const articleContext = articles
        .slice(0, 20)
        .map((article, index) => [
          `#${index + 1}`,
          `Titulo: ${article.title}`,
          `Legenda/noticia: ${article.summary}`,
          `Fonte: ${article.source}`,
          `Publicado em: ${article.publishedAt}`,
          `Link: ${article.link}`,
        ].join('\n'))
        .join('\n\n');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Você é um estrategista de conteúdo para Instagram com foco em relevância editorial.
Sua tarefa é selecionar SOMENTE as notícias/legendas que realmente combinam com a persona.

Regras:
- Escolha no máximo 10 itens.
- Descarte o que for genérico, distante do nicho ou sem ponte clara para o público.
- Prefira itens que tenham utilidade prática, tensão, mudança de mercado, caso real, aprendizado tático ou implicações diretas para o nicho.
- Responda apenas com JSON.

Formato:
{
  "selected": [
    {
      "index": 1,
      "reason": "Por que esse item é relevante para a persona"
    }
  ]
}`,
          },
          {
            role: 'user',
            content: `PERSONA:
Nicho principal: ${persona.nicho_principal}
Subnichos: ${persona.subnichos.join(', ') || 'Nenhum'}
Pontos fortes: ${persona.pontos_fortes.join(', ') || 'Nenhum'}
Pontos fracos: ${persona.pontos_fracos.join(', ') || 'Nenhum'}
Publico-alvo: ${persona.publico_alvo}
Posicionamento: ${persona.posicionamento}
Resumo psicologico: ${persona.resumo_psicologico}

ITENS DISPONIVEIS:
${articleContext}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return articles.slice(0, 6);
      }

      const parsed = JSON.parse(content);
      const selected = Array.isArray(parsed.selected) ? parsed.selected : [];

      const picked = selected
        .map((item: any) => {
          const index = Number(item.index) - 1;
          const article = articles[index];
          if (!article) {
            return null;
          }

          return {
            ...article,
            relevanceReason: typeof item.reason === 'string' ? item.reason : undefined,
          } satisfies NewsArticle;
        })
        .filter(Boolean) as NewsArticle[];

      return picked.length > 0 ? picked.slice(0, 6) : articles.slice(0, 6);
    } catch (error) {
      this.logger.error('Error selecting relevant news articles', error);
      return articles.slice(0, 6);
    }
  }

  async generateNewsBackedTrends(
    persona: NormalizedPersona,
    articles: NewsArticle[],
  ): Promise<TrendSuggestion[]> {
    this.logger.log(`Generating news-backed trends for niche: ${persona.nicho_principal}`);

    try {
      const articleContext = articles
        .slice(0, 15)
        .map((article, index) => {
          const publishedLabel = new Date(article.publishedAt).toISOString();
          return [
            `#${index + 1}`,
            `Titulo: ${article.title}`,
            `Resumo: ${article.summary || 'Sem resumo adicional'}`,
            article.relevanceReason ? `Motivo de relevancia: ${article.relevanceReason}` : null,
            `Fonte: ${article.source}`,
            `Publicado em: ${publishedLabel}`,
            `Link: ${article.link}`,
          ]
            .filter(Boolean)
            .join('\n');
        })
        .join('\n\n');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Você é um estrategista sênior de conteúdo para Instagram.
Sua tarefa é transformar notícias quentes e tendências recentes em pautas de carrossel altamente compartilháveis para um criador.

Regras:
- Use APENAS os sinais das legendas fornecidas, que resumem noticias publicadas pelo perfil @notjournal.ai.
- Cruze as notícias com a persona para sugerir pautas com alto potencial de viralização no Instagram.
- Trabalhe apenas com os itens que forem claramente aderentes ao nicho e ao publico; ignore o restante.
- Prefira ângulos com debate, novidade, urgência, contrarianismo, utilidade prática ou impacto direto no nicho.
- Não invente fatos.
- Todo o conteúdo deve ser em Português Brasileiro.
- Gere EXATAMENTE 10 sugestões.
- Cada sugestão precisa citar um recorte concreto da noticia, nao um tema genérico.
- Priorize histórias, decisões, movimentos de mercado e casos reais que possam virar aprendizado acionável.

Responda APENAS com JSON válido neste formato:
{
  "trends": [
    {
      "title": "Headline curta e forte",
      "summary": "Resumo em 2-3 frases explicando o fato concreto da notícia, o gancho editorial e por que isso importa para a persona",
      "source": "Fonte principal usada para a pauta",
      "sourceUrl": "https://...",
      "relevanceScore": 0
    }
  ]
}`,
          },
          {
            role: 'user',
            content: `PERSONA:
Nicho principal: ${persona.nicho_principal}
Subnichos: ${persona.subnichos.join(', ') || 'Nenhum'}
Pontos fortes: ${persona.pontos_fortes.join(', ') || 'Nenhum'}
Pontos fracos: ${persona.pontos_fracos.join(', ') || 'Nenhum'}
Fator de viralizacao: ${persona.fator_viralizacao}
Publico-alvo: ${persona.publico_alvo}
Posicionamento: ${persona.posicionamento}
Resumo psicologico: ${persona.resumo_psicologico}

NOTICIAS E TENDENCIAS RECENTES:
${articleContext}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content returned for news-backed trends');
      }

      const parsed = JSON.parse(content);

      return (parsed.trends || [])
        .filter((trend: TrendSuggestion) => trend?.title && trend?.summary)
        .slice(0, 10)
        .map((trend: TrendSuggestion) => ({
          title: trend.title,
          summary: trend.summary,
          source: trend.source || 'Instagram @notjournal.ai',
          sourceUrl: trend.sourceUrl,
          relevanceScore: Math.round(Math.max(0, Math.min(100, Number(trend.relevanceScore) || 85))),
        }));
    } catch (error) {
      this.logger.error('Error generating news-backed trends', error);
      return [];
    }
  }

  async analyzeCompetitorPosts(competitorHandle: string, captions: string[], persona: PersonaResult): Promise<string> {
    this.logger.log(`Analyzing real posts from competitor: @${competitorHandle}`);
    try {
      const postsContent = captions.slice(0, 20).join('\n---\n');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Você é um Estrategista Competitivo de Elite para negócios digitais e criadores de conteúdo.
Sua missão é ler legendas e conteúdos REAIS do concorrente para deduzir sua estratégia de marketing, posicionamento e falhas.
Baseado nas capturas reais dos últimos posts deste concorrente, detalhe:
1. Padrões de Vendas & CTAs: Eles vendem agressivamente ou sutilmente? O que estão vendendo?
2. Pontos Fortes Notáveis: O que eles fazem extremamente bem e que engaja a audiência?
3. Pontos Cegos & Fraquezas: O que falta nesse conteúdo? Eles são genéricos? Falta densidade?
4. Plano de Ataque: Como nosso influenciador pode criar "oceanos azuis" ou bater de frente com as deficiências desse concorrente?

Responda em texto corrido, altamente estratégico, direto ao ponto e claro (máx. 400 palavras).`,
          },
          {
            role: 'user',
            content: `Concorrente Analisado: @${competitorHandle}\n\nO nicho/posicionamento do nosso próprio criador é: ${persona.nicho_principal || persona.content_niche} | ${persona.posicionamento || persona.tone_of_voice || 'Desconhecido'}\n\nAqui estão os últimos posts publicados do concorrente:\n${postsContent}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 1500,
      });

      return response.choices[0]?.message?.content || 'Análise indisponível.';
    } catch (error) {
      this.logger.error('Error generating competitor deep analysis', error);
      return 'Análise de concorrência não gerada devido a um erro na extração.';
    }
  }

  async generateCarousel(topic: string, templateContext: string, persona: PersonaResult, objectives?: CreatorObjectives, competitorAnalysis?: string): Promise<CarouselPreviewResult> {
    this.logger.log(`Generating carousel content for topic: ${topic}`);
    try {
      const anglePlan = await this.planCarouselAngle(topic, persona, objectives, competitorAnalysis);
      const structurePlan = await this.buildCarouselStructure(topic, templateContext, persona, anglePlan, objectives, competitorAnalysis);
      const critique = await this.critiqueCarouselDraft(topic, persona, anglePlan, structurePlan, objectives, competitorAnalysis);
      const rewritten = await this.rewriteCarouselDraft(topic, templateContext, persona, anglePlan, structurePlan, critique, objectives, competitorAnalysis);
      const deepened = await this.ensureCarouselDepth(topic, templateContext, persona, rewritten, objectives, competitorAnalysis);
      return await this.ensureCarouselUniqueness(topic, templateContext, persona, deepened, objectives, competitorAnalysis);
    } catch (error) {
      this.logger.error('Error generating carousel', error);
      throw error;
    }
  }

  async generateFactoryImage(prompt: string, templateStyle: string = 'editorial'): Promise<string> {
    try {
      const stylePrompt = [
        'Create a premium editorial Instagram carousel visual.',
        'Use a photographic, magazine-like composition.',
        'Preserve generous negative space for typography overlays.',
        'Avoid adding readable text inside the image.',
        'Style reference: luxury business editorial, high contrast, refined lighting, modern campaign art direction.',
        `Template style: ${templateStyle}.`,
        `Scene prompt: ${prompt}`,
      ].join(' ');

      const response = await this.openai.images.generate({
        model: 'gpt-image-1',
        prompt: stylePrompt,
        size: '1024x1536',
      });

      const base64Image = response.data?.[0]?.b64_json;
      if (!base64Image) {
        throw new Error('No image returned from OpenAI image generation');
      }

      return `data:image/png;base64,${base64Image}`;
    } catch (error) {
      this.logger.error('Error generating factory image', error);
      throw error;
    }
  }

  async generatePinterestQueries(prompt: string, templateStyle: string = 'editorial'): Promise<string[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Você gera consultas curtas e úteis para buscar referências visuais no Pinterest.

Regras:
- Gere exatamente 3 queries.
- As queries devem ser em inglês para melhorar o resultado visual.
- Foque em direção de arte, fotografia, editorial, composição, moda, negócios, retrato ou campanha, conforme o prompt.
- Evite frases longas.
- Responda apenas com JSON.

Formato:
{
  "queries": ["query 1", "query 2", "query 3"]
}`,
          },
          {
            role: 'user',
            content: `Prompt visual: ${prompt}\nTemplate style: ${templateStyle}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return [];
      }

      const parsed = JSON.parse(content) as PinterestReferenceResult;
      return Array.isArray(parsed.queries) ? parsed.queries.slice(0, 3) : [];
    } catch (error) {
      this.logger.error('Error generating Pinterest queries', error);
      return [];
    }
  }

  private async planCarouselAngle(
    topic: string,
    persona: PersonaResult,
    objectives?: CreatorObjectives,
    competitorAnalysis?: string
  ): Promise<CarouselAnglePlan> {
    const model = this.getFineTunedOrDefaultModel();
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `Você é o Angle Agent, um Estrategista Editorial de elite. 
Sua função não é apenas resumir a notícia, mas encontrar o "fio invisível" que conecta um fato de mercado ao sistema nervoso da persona.

REGRAS DE OURO:
1. ANALISE PROFUNDA: Extraia dados brutos, porcentagens, nomes de CEOs e decisões específicas da notícia. O carrossel deve parecer que foi escrito por um insider.
2. FUJA DO ÓBVIO: Não repita o que o G1 ou a Forbes disseram. Encontre a "tese contra-intuitiva".
3. MODELOS DE TENSÃO: Escolha UM destes prismas para o Core Angle:
   - A GRANDE MENTIRA: Como a notícia prova que o que a persona acreditava está errado.
   - O CUSTO DA OMISSÃO: O que acontece com a persona se ela ignorar esse fato por mais 48h.
   - O NOVO PADRÃO: Por que o jeito antigo de trabalhar/viver morreu com essa notícia.
   - OPORTUNIDADE ASSIMÉTRICA: O que os grandes estão fazendo que a persona ainda não viu.
4. PSICOLOGIA APLICADA: Use o "Resumo Psicológico" para ferir o ego ou alimentar a ambição da persona através da notícia.
5. HOOKS DE ALTA RETENÇÃO: Gere ganchos que usem "Contraste" ou "Especificidade Extrema". 

Responda apenas com JSON.`,
        },
        {
          role: 'user',
          content: `TOPICO/NOTICIA:
${topic}

PERSONA:
Nicho: ${persona.nicho_principal || persona.content_niche}
Subnichos: ${persona.subnichos?.join(', ') || 'Nenhum'}
Publico-alvo: ${persona.publico_alvo || 'Público geral'}
Posicionamento: ${persona.posicionamento || persona.tone_of_voice || ''}
Resumo psicologico: ${persona.resumo_psicologico || persona.psychological_profile || ''}

OBJETIVOS DO CRIADOR:
Modelo de Negócio: ${objectives?.business_type || 'Não definido'}
Público Alvo Desejado: ${objectives?.target_audience || 'Não definido'}
Objetivos de Conteúdo: ${objectives?.content_goals || 'Não definido'}
Estratégia de Monetização: ${objectives?.monetization_strategy || 'Não definido'}

ANÁLISE DOS CONCORRENTES:
${competitorAnalysis || 'Não disponível'}

FORMATO DE SAÍDA:
{
  "coreAngle": "Tese editorial disruptiva cruzando o fato da notícia com a dor da persona",
  "whyNow": "A urgência imediata baseada em números ou mudanças reais da notícia",
  "audienceBridge": "O elo emocional: por que esse fato específico fere ou ajuda a persona hoje",
  "lesson": "A lição prática e acionável (insight de ouro)",
  "hookOptions": [
    "Hook focado em Antítese (Oposto do senso comum)",
    "Hook focado em Prova/Número (Dados da notícia)",
    "Hook focado em Autoridade/Ameaça"
  ]
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5, // Leve aumento para permitir ângulos mais criativos, mas ainda sob controle.
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No angle plan generated');
    }

    return JSON.parse(content) as CarouselAnglePlan;
  }

  private async buildCarouselStructure(
    topic: string,
    templateContext: string,
    persona: PersonaResult,
    anglePlan: CarouselAnglePlan,
    objectives?: CreatorObjectives,
    competitorAnalysis?: string
  ): Promise<CarouselStructurePlan> {
    const model = this.getFineTunedOrDefaultModel();
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `Você é o Structure Agent, focado em High-End Business Content (estilo Brands Decoded).
Sua missão é criar um roteiro denso, analítico e visualmente elegante.

REGRAS DE DENSIDADE E VOLUME:
- SLIDE 1 (HOOK): Deve ter entre 60 e 100 caracteres. Impacto puro.
- SLIDES DE CONTEÚDO (2 ao penúltimo): Cada slide DEVE ter entre 250 a 450 caracteres. Aprofunde na análise técnica, nos números da notícia e nas implicações para a persona.
- ÚLTIMO SLIDE (CTA FINAL): DEVE ser longo e com alto contexto. Baseie-se nos 'Objetivos de Monetização' e 'Audiência Desejada'. Não seja genérico ("Mande para um amigo"). Crie uma ponte lógica entre a lição aprendida e a ação esperada.
- FOCO EM DADOS: Valores da notícia OBRIGATORIAMENTE devem aparecer com destaque no roteiro.
- PROIBIÇÃO DE RÓTULOS: Nunca inclua rótulos estruturais no texto final (Ex: não escreva "Gancho:", "Problema:", "Slide:", "Estatística:", "Lição:"). Entregue apenas o copy limpo.

LEGENDA (MAIN CAPTION):
- Textos profundos, densos e instigantes (mínimo de 1200 caracteres, obrigatoriamente estruturada em 3 a 5 parágrafos).
- Aprofunde o impacto do fato na rotina ou negócio da audiência. O texto deve justificar a atenção do leitor.
- OBRIGATÓRIO incluir 1 ou 2 CTAs cirúrgicos no final da legenda que puxem comentários quentes ou direcionamentos de venda/funil (dependendo do modelo de negócio do criador).

Responda apenas com JSON.`,
        },
        {
          role: 'user',
          content: `TOPICO/NOTICIA:
${topic}

PERSONA:
Nicho: ${persona.nicho_principal}
Posicionamento: ${persona.posicionamento}
Resumo psicologico: ${persona.resumo_psicologico}

OBJETIVOS DO CRIADOR:
Modelo de Negócio: ${objectives?.business_type || 'Não definido'}
Público Alvo Desejado: ${objectives?.target_audience || 'Não definido'}
Objetivos de Conteúdo: ${objectives?.content_goals || 'Não definido'}
Estratégia de Monetização: ${objectives?.monetization_strategy || 'Não definido'}

ANÁLISE DOS CONCORRENTES:
${competitorAnalysis || 'Não disponível'}

ANGLE PLAN:
Tese: ${anglePlan.coreAngle}
Por que agora: ${anglePlan.whyNow}
Ponte com o publico: ${anglePlan.audienceBridge}
Licao: ${anglePlan.lesson}
Hooks: ${(anglePlan.hookOptions || []).join(' | ')}

TEMPLATE CONTEXT/ESTILO:
${templateContext}

FORMATO DE SAÍDA:
{
  "main_caption": "Texto da legenda em 3 a 5 parágrafos. Não use rótulos como 'Gancho:', 'Conclusão:'. Apenas o texto direto e fluido (min. 1200 caracteres)",
  "slides": [
    {
      "order": 1,
      "copy_text": "Texto do slide sem NENHUM rótulo estrutural antes. Apenas o copy limpo.",
      "ai_image_prompt": "Prompt visual em inglês estilo high-end"
    }
  ]
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No structure plan generated');
    }

    return JSON.parse(content) as CarouselStructurePlan;
  }

  private async critiqueCarouselDraft(
    topic: string,
    persona: PersonaResult,
    anglePlan: CarouselAnglePlan,
    draft: CarouselStructurePlan,
    objectives?: CreatorObjectives,
    competitorAnalysis?: string
  ): Promise<CarouselCritique> {
    const model = this.getFineTunedOrDefaultModel();
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `Você é o Editor-Chefe. Sua função é destruir a mediocridade e garantir sofisticação editorial.

CRITÉRIOS DE AVALIAÇÃO:
1. DENSIDADE ANALÍTICA: O texto está apenas descrevendo o que aconteceu ou está ANALISANDO o porquê? Se houver frases como "é importante notar", "no mundo de hoje" ou "cada vez mais", marque como FRAQUEZA. Queremos dados e teses.
2. PRECISÃO DE DADOS: Todos os números, nomes de CEOs e marcas relevantes da notícia foram aproveitados? Se o rascunho ignorou um dado de impacto, aponte em MISSING POINTS.
3. ÚLTIMO SLIDE: O CTA final está fraco, sem contexto ou genérico? Se sim, marque como FRAQUEZA e mande reescrever cruzando com a estratégia de monetização.
4. RÓTULOS E CLICHÊS: Os textos contêm vazamentos estruturais como "Lição:", "Gancho", "Estatística:"? Se sim, marque como FRAQUEZA EXTREMA. Apenas a copy pura deve constar.
5. LEGENDA: A legenda é densa (pelo menos 3 a 5 parágrafos), engajante e possui CTAs claros no final?

Não tenha medo de ser duro. Sua crítica deve forçar o redator final a ser brilhante.
Responda apenas com JSON.`,
        },
        {
          role: 'user',
          content: `TOPICO/NOTICIA:
${topic}

PERSONA & OBJETIVOS:
Nicho: ${persona.nicho_principal || persona.content_niche}
Publico-alvo Desejado: ${objectives?.target_audience || persona.publico_alvo || 'Público geral'}
Monetização Esperada: ${objectives?.monetization_strategy || 'Engajamento normal'}

ANGLE PLAN:
${JSON.stringify(anglePlan, null, 2)}

RASCUNHO PARA CRÍTICA:
${JSON.stringify(draft, null, 2)}

FORMATO DE SAÍDA:
{
  "strengths": ["O que está excelente e deve ser mantido"],
  "weaknesses": ["Textos com rótulos 'Gancho:', CTAs fracos no último slide, legendas curtas ou monolíticas (1 parágrafo), termos genéricos"],
  "missingPoints": ["Dados específicos da notícia que escaparam ou objetivos de negócio ignorados"],
  "rewritePriorities": ["As 3 ações principais para o Final Writer transformar esse post em High-End"]
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No critique generated');
    }

    return JSON.parse(content) as CarouselCritique;
  }
  private async rewriteCarouselDraft(
    topic: string,
    templateContext: string,
    persona: PersonaResult,
    anglePlan: CarouselAnglePlan,
    draft: CarouselStructurePlan,
    critique: CarouselCritique,
    objectives?: CreatorObjectives,
    competitorAnalysis?: string
  ): Promise<CarouselPreviewResult> {
    const model = this.getFineTunedOrDefaultModel();
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `Você é o Final Writer Agent (Diretor de Copywriting High-End). 
Sua função é entregar a versão final do carrossel, refinando o rascunho com o máximo rigor solicitado pela Crítica Editorial.

ESTILO E RITMO:
- DENSIDADE LÉXICA: Evite palavras vazias. Cada frase deve carregar um dado, uma análise ou um insight emocional. 
- PROIBIÇÃO ABSOLUTA DE RÓTULOS: É extremamente proibido escrever termos como "Gancho:", "Slide:", "Impacto:", "Lição:", "Estatística:", "Conclusão:". Entregue unicamente a Copy. O público final vai ler, não estamos preenchendo um fluxo interno.
- PROIBIÇÕES DE VOCABULARIO: Nunca use: "no mundo atual", "essencial", "crucial", "desvendar", "cada vez mais", "decifrar". 
- CTA ÚLTIMO SLIDE: O último slide tem obrigação de vender, posicionar ou direcionar como um CEO. Use os 'Objetivos de Monetização' da persona para criar uma argumentação imperativa e elaborada. (Se for para vender um serviço, fale com autoridade do serviço).

ESTRUTURA DA LEGENDA (MAIN_CAPTION):
- Aprofundamento bruto. O texto deve ter no MÍNIMO 1200 a 1800 caracteres E ser escrito com 3 a 5 parágrafos espaçados! Nada de texto em um único bloco.
- Explore o impacto não dito da notícia. Bata na concorrência da persona e reforce os valores de marca.
- Finalize com múltiplos micro-CTAs ou um Macro CTA altamente envolvente alinhado aos objetivos.

Responda apenas com JSON.`,
        },
        {
          role: 'user',
          content: `TOPICO/NOTICIA:
${topic}

PERSONA:
Nicho: ${persona.nicho_principal}
Posicionamento: ${persona.posicionamento}
Resumo psicologico: ${persona.resumo_psicologico}

OBJETIVOS DO CRIADOR:
Modelo de Negócio: ${objectives?.business_type || 'Não definido'}
Público Alvo Desejado: ${objectives?.target_audience || 'Não definido'}
Objetivos de Conteúdo: ${objectives?.content_goals || 'Não definido'}
Estratégia de Monetização: ${objectives?.monetization_strategy || 'Não definido'}

ANÁLISE DOS CONCORRENTES:
${competitorAnalysis || 'Não disponível'}

ANGLE PLAN:
${JSON.stringify(anglePlan, null, 2)}

RASCUNHO INICIAL:
${JSON.stringify(draft, null, 2)}

CRITICA EDITORIAL (OBRIGATÓRIO SEGUIR):
${JSON.stringify(critique, null, 2)}

INSTRUÇÕES FINAIS:
- Priorize os dados brutos da notícia sobre qualquer frase motivacional.
- Garanta que o slide 1 seja uma "parada de scroll" técnica e elegante.
- O slide final e o fim da legenda devem ter os CTAs mais persuasivos e inteligentes que você já escreveu.
- Respeite o 'templateContext' para manter o branding monochrome/minimalist no 'ai_image_prompt'.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.75, // Aumentada para garantir vocabulário mais rico e menos óbvio.
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No final carousel generated');
    }

    return JSON.parse(content) as CarouselPreviewResult;
  }

  private async ensureCarouselDepth(
    topic: string,
    templateContext: string,
    persona: PersonaResult,
    draft: CarouselPreviewResult,
    objectives?: CreatorObjectives,
    competitorAnalysis?: string,
  ): Promise<CarouselPreviewResult> {
    const captionParagraphs = draft.main_caption
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    const captionLongEnough = draft.main_caption.trim().length >= 1200;
    const captionStructured = captionParagraphs.length >= 3;
    const slidesLongEnough = draft.slides.every((slide) => this.countSentences(slide.copy_text) >= 3);

    if (captionLongEnough && captionStructured && slidesLongEnough) {
      return draft;
    }

    this.logger.warn(
      `Carousel depth below threshold. Caption chars=${draft.main_caption.trim().length}, paragraphs=${captionParagraphs.length}, slide sentence counts=${draft.slides.map((slide) => this.countSentences(slide.copy_text)).join(', ')}`
    );

    const expanded = await this.expandCarouselDepth(topic, templateContext, persona, draft, objectives, competitorAnalysis);

    return this.normalizeCarouselDepth(expanded);
  }

  private async expandCarouselDepth(
    topic: string,
    templateContext: string,
    persona: PersonaResult,
    draft: CarouselPreviewResult,
    objectives?: CreatorObjectives,
    competitorAnalysis?: string,
  ): Promise<CarouselPreviewResult> {
    const model = this.getFineTunedOrDefaultModel();
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `Você é o Depth Expansion Agent.
Sua função é pegar um carrossel curto demais e expandi-lo até o padrão editorial exigido.

REGRAS OBRIGATÓRIAS:
- A legenda precisa ter no mínimo 1200 caracteres.
- A legenda precisa ter entre 3 e 5 parágrafos separados por linha em branco.
- Cada slide precisa ter pelo menos 3 frases completas.
- Não invente fatos novos fora do tópico base.
- Mantenha densidade analítica, conexão com o público-alvo e CTA forte.
- Não use rótulos como "Gancho:", "Slide:", "CTA:".
- Responda apenas com JSON.

Formato:
{
  "main_caption": "Legenda expandida",
  "slides": [
    {
      "order": 1,
      "copy_text": "Texto expandido do slide",
      "ai_image_prompt": "Prompt visual em inglês"
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `TOPICO/NOTICIA:
${topic}

PERSONA:
Nicho: ${persona.nicho_principal || persona.content_niche}
Publico-alvo: ${objectives?.target_audience || persona.publico_alvo || 'Público geral'}
Posicionamento: ${persona.posicionamento || persona.tone_of_voice || ''}
Resumo psicologico: ${persona.resumo_psicologico || persona.psychological_profile || ''}
Estratégia de Monetização: ${objectives?.monetization_strategy || 'Não definida'}

ANÁLISE DE CONCORRÊNCIA:
${competitorAnalysis || 'Não disponível'}

TEMPLATE CONTEXT:
${templateContext}

CARROSSEL ATUAL QUE PRECISA SER EXPANDIDO:
${JSON.stringify(draft, null, 2)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.45,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return draft;
    }

    return JSON.parse(content) as CarouselPreviewResult;
  }

  private normalizeCarouselDepth(draft: CarouselPreviewResult): CarouselPreviewResult {
    const normalizedCaption = this.ensureCaptionParagraphs(draft.main_caption);
    const normalizedSlides = draft.slides.map((slide, index) => ({
      ...slide,
      copy_text: this.ensureMinimumSentences(slide.copy_text, 3, index, draft.slides.length),
    }));

    return {
      ...draft,
      main_caption: normalizedCaption,
      slides: normalizedSlides,
    };
  }

  private async ensureCarouselUniqueness(
    topic: string,
    templateContext: string,
    persona: PersonaResult,
    draft: CarouselPreviewResult,
    objectives?: CreatorObjectives,
    competitorAnalysis?: string,
  ): Promise<CarouselPreviewResult> {
    const redundancyByHeuristic = this.hasRepeatedSlides(draft.slides.map((slide) => slide.copy_text));

    if (!redundancyByHeuristic) {
      return draft;
    }

    this.logger.warn('Detected repeated or overly similar slides. Triggering dedupe review.');

    const review = await this.reviewCarouselRedundancy(topic, persona, draft, objectives, competitorAnalysis);

    if (!review.repetitive) {
      return draft;
    }

    return await this.rewriteRepeatedSlides(topic, templateContext, persona, draft, review, objectives, competitorAnalysis);
  }

  private async reviewCarouselRedundancy(
    topic: string,
    persona: PersonaResult,
    draft: CarouselPreviewResult,
    objectives?: CreatorObjectives,
    competitorAnalysis?: string,
  ): Promise<CarouselRedundancyReview> {
    const model = this.getFineTunedOrDefaultModel();
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `Você é o Redundancy Editor.
Sua função é detectar repetição de ideias entre slides.

Regras:
- Identifique slides que repetem a mesma tese, mesma formulação ou mesma consequência.
- O objetivo é fazer cada slide ter uma função distinta.
- Responda apenas com JSON.

Formato:
{
  "repetitive": true,
  "repeatedPairs": ["Slide 2 e Slide 3 repetem a mesma ideia"],
  "rewriteInstructions": ["Slide 2 deve focar no fato; slide 3 deve focar na implicação"]
}`,
        },
        {
          role: 'user',
          content: `TOPICO/NOTICIA:
${topic}

PERSONA:
Nicho: ${persona.nicho_principal || persona.content_niche}
Público-alvo: ${objectives?.target_audience || persona.publico_alvo || 'Público geral'}
Estratégia de Monetização: ${objectives?.monetization_strategy || 'Não definida'}

ANÁLISE DE CONCORRÊNCIA:
${competitorAnalysis || 'Não disponível'}

CARROSSEL:
${JSON.stringify(draft, null, 2)}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        repetitive: true,
        repeatedPairs: [],
        rewriteInstructions: [
          'Redistribua os slides para que cada um cumpra uma funcao editorial diferente e elimine frases espelhadas.',
        ],
      };
    }

    return JSON.parse(content) as CarouselRedundancyReview;
  }

  private async rewriteRepeatedSlides(
    topic: string,
    templateContext: string,
    persona: PersonaResult,
    draft: CarouselPreviewResult,
    review: CarouselRedundancyReview,
    objectives?: CreatorObjectives,
    competitorAnalysis?: string,
  ): Promise<CarouselPreviewResult> {
    const model = this.getFineTunedOrDefaultModel();
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `Você é o Slide Dedupe Agent.
Sua função é reescrever um carrossel que está repetitivo.

Regras:
- Mantenha 4 a 6 slides.
- Cada slide deve cumprir uma função única.
- Não repita a mesma conclusão com palavras diferentes.
- Preserve profundidade, legenda longa e CTA forte.
- Cada slide precisa ter pelo menos 3 frases.
- Distribua os slides em papeis editoriais distintos, como gancho, fato, leitura, implicacao, aplicacao e fechamento.
- Se um slide apresentar o fato, o proximo deve aprofundar ou traduzir, nunca apenas repetir.
- Evite reciclar a mesma abertura, o mesmo argumento central ou o mesmo CTA em dois slides.
- Responda apenas com JSON.

Formato:
{
  "main_caption": "Legenda final",
  "slides": [
    {
      "order": 1,
      "copy_text": "Texto único do slide",
      "ai_image_prompt": "Prompt visual em inglês"
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `TOPICO/NOTICIA:
${topic}

PERSONA:
Nicho: ${persona.nicho_principal || persona.content_niche}
Público-alvo: ${objectives?.target_audience || persona.publico_alvo || 'Público geral'}
Posicionamento: ${persona.posicionamento || persona.tone_of_voice || ''}

TEMPLATE CONTEXT:
${templateContext}

CARROSSEL REPETITIVO:
${JSON.stringify(draft, null, 2)}

PARES REPETIDOS:
${JSON.stringify(review.repeatedPairs, null, 2)}

INSTRUÇÕES DE REESCRITA:
${JSON.stringify(review.rewriteInstructions, null, 2)}

ANÁLISE DE CONCORRÊNCIA:
${competitorAnalysis || 'Não disponível'}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.35,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return draft;
    }

    const rewritten = JSON.parse(content) as CarouselPreviewResult;
    return this.normalizeCarouselDepth(rewritten);
  }

  private ensureCaptionParagraphs(text: string): string {
    const trimmed = text.trim();
    const paragraphs = trimmed
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    if (paragraphs.length >= 3) {
      return paragraphs.join('\n\n');
    }

    const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);
    const buckets = [sentences.slice(0, 3), sentences.slice(3, 6), sentences.slice(6)];
    const rebuilt = buckets
      .map((bucket) => bucket.join(' ').trim())
      .filter(Boolean);

    return rebuilt.join('\n\n');
  }

  private ensureMinimumSentences(text: string, minimum: number, index: number, totalSlides: number): string {
    const trimmed = text.trim();
    const count = this.countSentences(trimmed);

    if (count >= minimum) {
      return trimmed;
    }

    const role = this.getSlideRole(index, totalSlides);
    const subject = this.extractSlideSubject(trimmed);
    const additions = this.buildContextualSlideExpansions(subject, role);
    const existingSentences = trimmed
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    for (const addition of additions) {
      if (existingSentences.length >= minimum) {
        break;
      }

      existingSentences.push(addition);
    }

    return existingSentences.join(' ');
  }

  private countSentences(text: string): number {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0).length;
  }

  private getSlideRole(index: number, totalSlides: number): string {
    const lastIndex = Math.max(totalSlides - 1, 0);

    if (index === 0) {
      return 'hook';
    }

    if (index === lastIndex) {
      return 'cta';
    }

    if (index === 1) {
      return 'fact';
    }

    if (index === 2) {
      return 'implication';
    }

    if (index === 3) {
      return 'application';
    }

    return 'deepening';
  }

  private extractSlideSubject(text: string): string {
    const normalized = text.replace(/\s+/g, ' ').trim();

    if (!normalized) {
      return 'esse movimento';
    }

    const tokens = normalized
      .split(' ')
      .map((token) => token.replace(/[^\p{L}\p{N}-]/gu, ''))
      .filter((token) => token.length > 2)
      .slice(0, 8);

    return tokens.join(' ') || 'esse movimento';
  }

  private buildContextualSlideExpansions(subject: string, role: string): string[] {
    switch (role) {
      case 'hook':
        return [
          `O ponto mais forte em ${subject} nao esta so no fato isolado, mas no sinal de mercado que ele entrega para quem sabe ler contexto.`,
          `Quando esse tipo de movimento vira conteudo, o que prende a audiencia e mostrar por que isso mexe com decisao, percepcao e oportunidade agora.`,
        ];
      case 'fact':
        return [
          `O fato relevante em ${subject} precisa ser lido com contexto, porque numero sem interpretacao vira apenas curiosidade passageira.`,
          `Quando a gente conecta esse dado ao comportamento do mercado, fica mais claro por que essa historia saiu do campo da noticia e entrou no campo da estrategia.`,
        ];
      case 'implication':
        return [
          `A implicacao de ${subject} aparece quando o publico percebe que essa decisao muda referencia, expectativa e criterio de comparacao no nicho.`,
          `Isso ajuda a transformar a noticia em argumento, porque a audiencia entende nao so o que aconteceu, mas o que passa a importar depois disso.`,
        ];
      case 'application':
        return [
          `Para quem quer agir em cima de ${subject}, a leitura pratica esta em adaptar mensagem, oferta e posicionamento antes que esse angulo fique saturado.`,
          `Esse tipo de traducao torna o conteudo mais util, porque leva a conversa do comentario superficial para a aplicacao concreta no dia a dia.`,
        ];
      case 'cta':
        return [
          `O valor de ${subject} nao termina na observacao do caso, porque a melhor resposta da audiencia nasce quando ela compara esse movimento com a propria estrategia.`,
          `O proximo passo aqui e usar esse exemplo como espelho para decidir o que voce repetiria, o que evitaria e qual ajuste precisa amadurecer agora.`,
        ];
      default:
        return [
          `Em ${subject}, a camada menos obvia costuma ser a mais valiosa, porque e nela que surgem diferenciacao, timing e repertorio para construir um ponto de vista proprio.`,
          `Quando esse aprofundamento aparece no carrossel, a leitura deixa de soar generica e passa a entregar uma conclusao que realmente ajuda o publico a pensar melhor.`,
        ];
    }
  }

  private hasRepeatedSlides(slides: string[]): boolean {
    const normalized = slides.map((slide) =>
      slide
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );

    for (let i = 0; i < normalized.length; i += 1) {
      for (let j = i + 1; j < normalized.length; j += 1) {
        const similarity = this.jaccardSimilarity(normalized[i], normalized[j]);
        if (similarity >= 0.62) {
          return true;
        }
      }
    }

    return false;
  }

  private jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(a.split(' ').filter((token) => token.length > 3));
    const setB = new Set(b.split(' ').filter((token) => token.length > 3));

    if (setA.size === 0 || setB.size === 0) {
      return 0;
    }

    const intersection = [...setA].filter((token) => setB.has(token)).length;
    const union = new Set([...setA, ...setB]).size;

    return intersection / union;
  }
}
