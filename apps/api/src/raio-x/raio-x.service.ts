import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase.service';
import { InstagramService } from '../instagram.service';
import { OpenaiService } from '../openai.service';

@Injectable()
export class RaioXService {
  private readonly logger = new Logger(RaioXService.name);

  constructor(
    private supabase: SupabaseService,
    private instagram: InstagramService,
    private openai: OpenaiService,
  ) { }

  async startAnalysis(profileId: string, handle: string, accessToken: string) {
    if (!profileId || !handle || !accessToken) {
      throw new Error('Missing require parameters (profileId, handle or token)');
    }

    // Execute the async flow without blocking the HTTP request (fire-and-forget for MVP)
    this.runAsyncFlow(profileId, handle, accessToken, `mock-${handle}`).catch((err) => {
      this.logger.error('Background flow failed', err);
    });

    return { status: 'STARTED', message: 'Analysis queued successfully.' };
  }

  getFacebookOauthUrl(profileId: string): string {
    return this.instagram.getAuthorizationUrl(profileId);
  }

  async handleOauthCallback(code: string, profileId: string): Promise<void> {
    this.logger.log(`Exchanging OAuth code for token for profile ${profileId}`);

    // 1. Troca o 'code' temporário pela Access Token de longa duração
    const accessToken = await this.instagram.exchangeCodeForToken(code);

    this.logger.log(`Access Token: ${accessToken}`);

    // 2. Busca o @username e ID do Instagram da pessoa logada
    const { igUserId, username } = await this.instagram.getIgProfileInfo(accessToken);

    // 3. Roda o fluxo assíncrono normalmente
    this.runAsyncFlow(profileId, username, accessToken, igUserId).catch((err) => {
      this.logger.error('Background flow failed after OAuth', err);
    });
  }

  private async runAsyncFlow(profileId: string, handle: string, token: string, igUserId: string) {
    this.logger.log(`Starting RaioX Flow for profile ${profileId}`);
    const sbClient = this.supabase.getClient();

    // 1. Fetch Instagram Posts
    this.logger.log('Fetching Instagram Posts...');
    const posts = await this.instagram.fetchUserPosts(igUserId, token, 10);

    // 2. Save Posts to DB
    for (const post of posts) {
      const { error } = await sbClient.from('post_metrics').upsert({
        profile_id: profileId,
        ig_media_id: post.id,
        media_type: post.media_type,
        caption: post.caption,
        posted_at: post.timestamp,
      }, { onConflict: 'ig_media_id' }); // Note: onConflict requires the exact constraint setup, we might just insert for now if we don't have unique constraint.
      if (error) {
        this.logger.warn(`Could not insert metric for post ${post.id}: ${error.message}`);
      }
    }

    // 3. AI Persona definition
    const captions = posts.map(p => p.caption || '').filter(t => t.length > 5);
    if (captions.length === 0) {
      throw new Error('Not enough captions to analyze persona');
    }
    this.logger.log('Sending posts to OpenAI...');
    const persona = await this.openai.analyzePersona(captions);

    // 4. Save the new Persona to trigger Supabase Realtime in the frontend
    this.logger.log('Saving Persona to DB...', persona);
    const { error: personaError } = await sbClient.from('brand_personas').insert({
      profile_id: profileId,
      primary_goal: persona.primary_goal,
      content_niche: persona.content_niche,
      tone_of_voice: persona.tone_of_voice,
      psychological_profile: persona.psychological_profile,
      visual_preferences: persona.visual_preferences,
    });

    if (personaError) {
      this.logger.error('Failed to insert Persona:', personaError.message);
    }

    // 5. Update Connection Status
    await sbClient.from('instagram_connections').insert({
      profile_id: profileId,
      ig_user_id: igUserId,
      username: handle,
      access_token: token,
      status: 'active',
    });

    this.logger.log(`Finished processing Raio-X for ${handle}. Realtime event should have dispatched.`);
  }
}
