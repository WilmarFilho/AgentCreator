import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabse/supabase.service';
import { InstagramService, InstagramPost, CarouselChild } from '../apify/instagram.service';
import { OpenaiService, DeepContentPayload } from '../openai/openai.service';
import { MediaProcessorService } from './media-processor.service';

@Injectable()
export class RaioXService {
  private readonly logger = new Logger(RaioXService.name);

  constructor(
    private supabase: SupabaseService,
    private instagram: InstagramService,
    private openai: OpenaiService,
    private mediaProcessor: MediaProcessorService,
  ) { }

  async startAnalysis(profileId: string, handle: string, accessToken: string, igUserId: string) {
    if (!profileId || !handle || !accessToken || !igUserId) {
      throw new Error('Missing require parameters (profileId, handle, token or igUserId)');
    }

    this.runDeepAnalysisFlow(profileId, handle, accessToken, igUserId).catch((err) => {
      this.logger.error('Background deep analysis flow failed', err);
    });

    return { status: 'STARTED', message: 'Deep analysis queued successfully.' };
  }

  getFacebookOauthUrl(profileId: string): string {
    return this.instagram.getAuthorizationUrl(profileId);
  }

  async handleOauthCallback(code: string, profileId: string): Promise<string> {
    this.logger.log(`Exchanging OAuth code for token for profile ${profileId}`);
    const accessToken = await this.instagram.exchangeCodeForToken(code);
    this.logger.log(`Access Token obtained`);
    return accessToken;
  }

  async getAvailableAccounts(token: string) {
    return await this.instagram.getAvailableIgAccounts(token);
  }

  async saveObjectives(profileId: string, objectives: Record<string, string>) {
    const sbClient = this.supabase.getClient();
    const { data, error } = await sbClient.from('creator_objectives').upsert({
      profile_id: profileId,
      business_type: objectives.business_type || null,
      target_audience: objectives.target_audience || null,
      content_goals: objectives.content_goals || null,
      monetization_strategy: objectives.monetization_strategy || null,
      brand_values: objectives.brand_values || null,
      competitors: objectives.competitors || null,
      extra_notes: objectives.extra_notes || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id' }).select().single();

    if (error) {
      this.logger.error('Failed to save objectives:', error.message);
      throw error;
    }

    // Also save objectives to RAG for future consumption
    const objectivesText = Object.entries(objectives)
      .filter(([, v]) => v && v.length > 0)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    if (objectivesText.length > 10) {
      try {
        const embedding = await this.openai.generateEmbedding(`Objetivos do criador:\n${objectivesText}`);
        // Remove old objectives RAG doc
        await sbClient.from('profile_rag_documents')
          .delete()
          .eq('profile_id', profileId)
          .eq('source_type', 'persona_summary')
          .like('content', 'Objetivos do criador%');

        await sbClient.from('profile_rag_documents').insert({
          profile_id: profileId,
          source_type: 'persona_summary',
          content: `Objetivos do criador:\n${objectivesText}`,
          embedding: JSON.stringify(embedding),
          metadata: { type: 'creator_objectives', updated_at: new Date().toISOString() },
        });
      } catch (err: any) {
        this.logger.warn(`Failed to save objectives to RAG: ${err.message}`);
      }
    }

    return data;
  }

  async getObjectives(profileId: string) {
    const sbClient = this.supabase.getClient();
    const { data, error } = await sbClient.from('creator_objectives')
      .select('*')
      .eq('profile_id', profileId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      this.logger.error('Failed to get objectives:', error.message);
    }
    return data || null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DEEP ANALYSIS FLOW
  // ═══════════════════════════════════════════════════════════════════════

  private async runDeepAnalysisFlow(profileId: string, handle: string, token: string, igUserId: string) {
    this.logger.log(`🚀 Starting DEEP RaioX Flow for profile ${profileId} (@${handle})`);
    const sbClient = this.supabase.getClient();

    // ─── STEP 0: Clean up old data ────────────────────────────────────
    this.logger.log('🧹 Cleaning up previous analysis data...');
    await this.cleanupPreviousAnalysis(profileId);

    // ─── STEP 1: Fetch 15 posts (with pagination) ─────────────────────
    this.logger.log('📥 Fetching up to 15 Instagram posts...');
    const posts = await this.instagram.fetchUserPosts(igUserId, token, 15);
    this.logger.log(`Fetched ${posts.length} posts total.`);

    if (posts.length === 0) {
      throw new Error('No posts found for this account.');
    }

    // ─── STEP 2: Save posts to DB, enrich with children, store media ──
    this.logger.log('💾 Saving posts and uploading media to storage...');
    const postDbRecords: { postId: string; dbId: string }[] = [];

    await this.runWithConcurrency(posts, 5, async (post) => {
      if (post.media_type === 'CAROUSEL_ALBUM') {
        post.children = await this.instagram.fetchCarouselChildren(post.id, token);
      }

      // Upload main media to Supabase Storage
      let mediaStoragePath: string | null = null;
      let thumbnailStoragePath: string | null = null;

      if (post.media_url) {
        const mediaType = post.media_type === 'VIDEO' ? 'VIDEO' : 'IMAGE';
        const result = await this.mediaProcessor.downloadAndStoreMedia(
          post.media_url,
          profileId,
          mediaType,
          `post_${post.id}`,
          sbClient,
        );
        if (result) {
          mediaStoragePath = result.storagePath;
          // For images, the thumbnail is the image itself
          if (post.media_type === 'IMAGE') {
            thumbnailStoragePath = result.storagePath;
          }
        }
      }

      // For carousels, store the first slide as thumbnail
      if (post.media_type === 'CAROUSEL_ALBUM' && post.children && post.children.length > 0) {
        const firstSlide = post.children[0];
        if (firstSlide.media_type === 'IMAGE' && firstSlide.media_url) {
          const thumbResult = await this.mediaProcessor.downloadAndStoreMedia(
            firstSlide.media_url,
            profileId,
            'IMAGE',
            `thumb_${post.id}`,
            sbClient,
          );
          if (thumbResult) {
            thumbnailStoragePath = thumbResult.storagePath;
          }
        }
      }



      const { data, error } = await sbClient.from('post_metrics').insert({
        profile_id: profileId,
        ig_media_id: post.id,
        media_type: post.media_type,
        caption: post.caption,
        posted_at: post.timestamp,
        media_storage_path: mediaStoragePath,
        thumbnail_storage_path: thumbnailStoragePath,
        metrics: post.metrics,
      }).select('id').single();

      if (error) {
        this.logger.warn(`Could not insert metric for post ${post.id}: ${error.message}`);
        return;
      }

      postDbRecords.push({ postId: post.id, dbId: data.id });
    });

    // ─── STEP 3: Process each post for deep content extraction (PARALLEL) ─
    const extractionStart = Date.now();
    this.logger.log('🔍 Starting PARALLEL content extraction (concurrency=5)...');
    const deepContent: DeepContentPayload = {
      captions: [],
      imageAnalyses: [],
      videoTranscriptions: [],
    };

    const ragDocuments: {
      content: string;
      sourceType: 'caption' | 'image_analysis' | 'video_transcription';
      sourcePostId: string;
      metadata: Record<string, any>;
    }[] = [];

    await this.runWithConcurrency(posts, 5, async (post, i) => {
      const dbRecord = postDbRecords.find(r => r.postId === post.id);
      if (!dbRecord) return;

      const postLabel = `[${i + 1}/${posts.length}] Post ${post.id} (${post.media_type})`;
      this.logger.log(`Processing ${postLabel}...`);

      // 3a. Caption
      if (post.caption && post.caption.length > 5) {
        deepContent.captions.push(post.caption);

        await sbClient.from('post_content_analysis').insert({
          post_metric_id: dbRecord.dbId,
          profile_id: profileId,
          content_type: 'caption',
          content_text: post.caption,
        });

        ragDocuments.push({
          content: post.caption,
          sourceType: 'caption',
          sourcePostId: dbRecord.dbId,
          metadata: { media_type: post.media_type, posted_at: post.timestamp },
        });
      }

      // 3b. IMAGE — Analyze with GPT-4o Vision
      if (post.media_type === 'IMAGE' && post.media_url) {
        try {
          this.logger.debug(`🖼️  Analyzing image for ${postLabel}...`);
          const analysis = await this.openai.analyzeImage(post.media_url);
          deepContent.imageAnalyses.push(analysis);

          await sbClient.from('post_content_analysis').insert({
            post_metric_id: dbRecord.dbId,
            profile_id: profileId,
            content_type: 'image_analysis',
            content_text: analysis,
            media_url: post.media_url,
          });

          ragDocuments.push({
            content: analysis,
            sourceType: 'image_analysis',
            sourcePostId: dbRecord.dbId,
            metadata: { media_type: 'IMAGE', posted_at: post.timestamp },
          });
        } catch (err: any) {
          this.logger.warn(`Failed to analyze image for ${postLabel}: ${err.message}`);
        }
      }

      // 3c. CAROUSEL — Upload each slide + analyze
      if (post.media_type === 'CAROUSEL_ALBUM' && post.children) {
        const children = post.children;
        await this.runWithConcurrency(children, 3, async (child, slideIdx) => {

          // Upload each carousel slide to storage
          let slideStoragePath: string | null = null;
          if (child.media_url) {
            const slideResult = await this.mediaProcessor.downloadAndStoreMedia(
              child.media_url,
              profileId,
              child.media_type,
              `slide_${post.id}_${slideIdx}`,
              sbClient,
            );
            if (slideResult) {
              slideStoragePath = slideResult.storagePath;
            }
          }

          if (child.media_type === 'IMAGE' && child.media_url) {
            try {
              this.logger.debug(`🖼️  Analyzing carousel slide ${slideIdx + 1}/${children.length}...`);
              const analysis = await this.openai.analyzeImage(child.media_url);
              deepContent.imageAnalyses.push(analysis);

              await sbClient.from('post_content_analysis').insert({
                post_metric_id: dbRecord.dbId,
                profile_id: profileId,
                content_type: 'image_analysis',
                content_text: analysis,
                media_url: child.media_url,
                slide_index: slideIdx,
                storage_path: slideStoragePath,
              });

              ragDocuments.push({
                content: analysis,
                sourceType: 'image_analysis',
                sourcePostId: dbRecord.dbId,
                metadata: { media_type: 'CAROUSEL_SLIDE', slide_index: slideIdx, posted_at: post.timestamp },
              });
            } catch (err: any) {
              this.logger.warn(`Failed to analyze carousel slide ${slideIdx}: ${err.message}`);
            }
          }

          if (child.media_type === 'VIDEO' && child.media_url) {
            try {
              this.logger.debug(`🎬 Transcribing carousel video slide ${slideIdx + 1}...`);
              const audioBuffer = await this.mediaProcessor.extractAudioFromVideo(child.media_url);
              const transcription = await this.openai.transcribeAudio(audioBuffer);
              deepContent.videoTranscriptions.push(transcription);

              await sbClient.from('post_content_analysis').insert({
                post_metric_id: dbRecord.dbId,
                profile_id: profileId,
                content_type: 'video_transcription',
                content_text: transcription,
                media_url: child.media_url,
                slide_index: slideIdx,
                storage_path: slideStoragePath,
              });

              ragDocuments.push({
                content: transcription,
                sourceType: 'video_transcription',
                sourcePostId: dbRecord.dbId,
                metadata: { media_type: 'CAROUSEL_VIDEO', slide_index: slideIdx, posted_at: post.timestamp },
              });
            } catch (err: any) {
              this.logger.warn(`Failed to transcribe carousel video slide ${slideIdx}: ${err.message}`);
            }
          }
        });
      }

      // 3d. VIDEO/REELS — Download, extract audio, transcribe
      if (post.media_type === 'VIDEO' && post.media_url) {
        try {
          this.logger.debug(`🎬 Processing video/reel for ${postLabel}...`);
          const audioBuffer = await this.mediaProcessor.extractAudioFromVideo(post.media_url);
          const transcription = await this.openai.transcribeAudio(audioBuffer);
          deepContent.videoTranscriptions.push(transcription);

          await sbClient.from('post_content_analysis').insert({
            post_metric_id: dbRecord.dbId,
            profile_id: profileId,
            content_type: 'video_transcription',
            content_text: transcription,
            media_url: post.media_url,
          });

          ragDocuments.push({
            content: transcription,
            sourceType: 'video_transcription',
            sourcePostId: dbRecord.dbId,
            metadata: { media_type: 'VIDEO', posted_at: post.timestamp },
          });
        } catch (err: any) {
          this.logger.warn(`Failed to process video for ${postLabel}: ${err.message}`);
        }
      }
    });

    const extractionSec = ((Date.now() - extractionStart) / 1000).toFixed(1);
    this.logger.log(`✅ Content extraction complete in ${extractionSec}s!`);
    this.logger.log(`   📝 Captions: ${deepContent.captions.length}`);
    this.logger.log(`   🖼️  Image analyses: ${deepContent.imageAnalyses.length}`);
    this.logger.log(`   🎬 Video transcriptions: ${deepContent.videoTranscriptions.length}`);

    // ─── STEP 4: Generate embeddings and save RAG documents ───────────
    this.logger.log('🧠 Generating embeddings for RAG storage...');
    await this.saveRagDocuments(profileId, ragDocuments);

    // ─── STEP 5: Deep Persona Analysis ────────────────────────────────
    this.logger.log('🎯 Running DEEP persona analysis with all content...');
    const persona = await this.openai.analyzePersonaDeep(deepContent);

    // ─── STEP 6: Save Persona to DB (triggers Realtime) ───────────────
    this.logger.log('💾 Saving deep persona to database...');
    const { error: personaError } = await sbClient.from('brand_personas').insert({
      profile_id: profileId,
      nicho_principal: persona.nicho_principal,
      subnichos: persona.subnichos,
      pontos_fortes: persona.pontos_fortes,
      pontos_fracos: persona.pontos_fracos,
      fator_viralizacao: persona.fator_viralizacao,
      resumo_psicologico: persona.resumo_psicologico,
      publico_alvo: persona.publico_alvo,
      posicionamento: persona.posicionamento,
    });

    if (personaError) {
      this.logger.error('Failed to insert Persona:', personaError.message);
    }

    // ─── STEP 7: Save persona summary as RAG document ─────────────────
    this.logger.log('📚 Saving persona summary as RAG document...');
    const personaSummary = `Brand Persona de @${handle}:\n` +
      `Objetivo Principal: ${persona.primary_goal}\n` +
      `Nicho: ${persona.content_niche}\n` +
      `Tom de Voz: ${persona.tone_of_voice}\n` +
      `Perfil Psicológico: ${persona.psychological_profile}\n` +
      `Preferências Visuais: ${JSON.stringify(persona.visual_preferences)}`;

    try {
      const embedding = await this.openai.generateEmbedding(personaSummary);
      await sbClient.from('profile_rag_documents').insert({
        profile_id: profileId,
        source_type: 'persona_summary',
        content: personaSummary,
        embedding: JSON.stringify(embedding),
        metadata: { generated_at: new Date().toISOString(), posts_analyzed: posts.length },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to save persona RAG document: ${err.message}`);
    }

    // ─── STEP 8: Save Instagram Connection ────────────────────────────
    const { data, error: connError } = await sbClient.from('instagram_connections').upsert({
      profile_id: profileId,
      ig_user_id: igUserId,
      username: handle,
      access_token: token,
      status: 'active',
    }, { onConflict: 'profile_id' });

    if (connError) {
      this.logger.error(`❌ Erro ao salvar conexão: ${connError.message}`);
      this.logger.error(`Detalhes: ${connError.details} | Hint: ${connError.hint}`);
    } else {
      this.logger.log('✅ Conexão salva ou atualizada com sucesso no banco!');
    }

    this.logger.log('profileId', profileId);
    this.logger.log('igUserId', igUserId);
    this.logger.log('handle', handle);
    this.logger.log('token', token);

    this.logger.log(`🏁 Finished DEEP RaioX for @${handle}. ${posts.length} posts analyzed, RAG saved.`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  private async cleanupPreviousAnalysis(profileId: string) {
    const sbClient = this.supabase.getClient();

    // Delete RAG documents
    const { error: ragError } = await sbClient
      .from('profile_rag_documents')
      .delete()
      .eq('profile_id', profileId);
    if (ragError) this.logger.warn(`Cleanup RAG error: ${ragError.message}`);

    // Delete content analysis
    const { error: contentError } = await sbClient
      .from('post_content_analysis')
      .delete()
      .eq('profile_id', profileId);
    if (contentError) this.logger.warn(`Cleanup content analysis error: ${contentError.message}`);

    // Delete post metrics
    const { error: metricsError } = await sbClient
      .from('post_metrics')
      .delete()
      .eq('profile_id', profileId);
    if (metricsError) this.logger.warn(`Cleanup post metrics error: ${metricsError.message}`);

    // Delete brand personas
    const { error: personaError } = await sbClient
      .from('brand_personas')
      .delete()
      .eq('profile_id', profileId);
    if (personaError) this.logger.warn(`Cleanup persona error: ${personaError.message}`);

    // Clean up storage files
    await this.mediaProcessor.cleanupProfileMedia(profileId, sbClient);

    this.logger.log('Previous analysis data cleaned up.');
  }

  private async saveRagDocuments(
    profileId: string,
    documents: Array<{
      content: string;
      sourceType: 'caption' | 'image_analysis' | 'video_transcription';
      sourcePostId: string;
      metadata: Record<string, any>;
    }>
  ) {
    if (documents.length === 0) {
      this.logger.warn('No documents to save for RAG.');
      return;
    }

    const sbClient = this.supabase.getClient();
    const batchSize = 20;

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const texts = batch.map(d => d.content);

      try {
        this.logger.debug(`Generating embeddings batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}...`);
        const embeddings = await this.openai.generateEmbeddingsBatch(texts);

        const rows = batch.map((doc, idx) => ({
          profile_id: profileId,
          source_type: doc.sourceType,
          source_post_id: doc.sourcePostId,
          content: doc.content,
          embedding: JSON.stringify(embeddings[idx]),
          metadata: doc.metadata,
        }));

        const { error } = await sbClient.from('profile_rag_documents').insert(rows);
        if (error) {
          this.logger.error(`Failed to insert RAG batch: ${error.message}`);
        } else {
          this.logger.debug(`Saved ${rows.length} RAG documents (batch ${Math.floor(i / batchSize) + 1})`);
        }
      } catch (err: any) {
        this.logger.error(`Failed to process RAG batch: ${err.message}`);
      }
    }

    this.logger.log(`📚 Total RAG documents saved: ${documents.length}`);
  }

  /**
   * Executes async tasks with a concurrency limit.
   * Like Promise.all but limits how many run simultaneously.
   */
  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    fn: (item: T, index: number) => Promise<void>,
  ): Promise<void> {
    const executing: Promise<void>[] = [];

    for (let i = 0; i < items.length; i++) {
      const p = fn(items[i], i).then(() => {
        executing.splice(executing.indexOf(p), 1);
      });
      executing.push(p);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
  }
}
