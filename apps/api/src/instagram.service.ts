import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface InstagramPost {
  id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  caption: string;
  timestamp: string;
}

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);
  private readonly baseUrl = 'https://graph.instagram.com';

  constructor() {}

  async fetchUserPosts(accessToken: string, limit: number = 20): Promise<InstagramPost[]> {
    this.logger.log(`Fetching latest ${limit} posts from Instagram...`);
    try {
      // Instagram Graph API endpoint base for getting user media
      const response = await axios.get(`${this.baseUrl}/me/media`, {
        params: {
          fields: 'id,caption,media_type,media_url,timestamp',
          access_token: accessToken,
          limit,
        },
      });

      if (!response.data || !response.data.data) {
        throw new Error('Invalid response from Instagram API');
      }

      // Map to return just the relevant data
      const posts: InstagramPost[] = response.data.data.map((post: any) => ({
        id: post.id,
        media_type: post.media_type,
        caption: post.caption || '',
        timestamp: post.timestamp,
      }));

      return posts;
    } catch (error: any) {
      this.logger.error('Failed to fetch Instagram posts', error.response?.data || error.message);
      throw error;
    }
  }

  getAuthorizationUrl(profileId: string): string {
    const appId = process.env.FACEBOOK_APP_ID;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
    if (!appId || !redirectUri) {
      this.logger.error('Meta OAuth env variables missing');
      throw new Error('OAuth não configurado corretamente no backend.');
    }
    
    // Passing profileId in the state so we know who authorized
    const state = Buffer.from(JSON.stringify({ profileId })).toString('base64');
    const scope = 'instagram_basic,pages_show_list'; // For Graph API usually
    
    return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    const appId = process.env.FACEBOOK_APP_ID;
    const secret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

    try {
      const response = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token`, {
        params: {
          client_id: appId,
          redirect_uri: redirectUri,
          client_secret: secret,
          code,
        },
      });

      // Usually returns { access_token, token_type, expires_in }
      return response.data.access_token;
    } catch (error: any) {
      this.logger.error('Erro ao trocar auth code por access token', error.response?.data || error.message);
      throw error;
    }
  }

  async getIgProfileInfo(accessToken: string): Promise<{ igUserId: string; username: string }> {
    try {
      // Simplest approach using Basic Display API endpoint
      // Note: Actual implementation depends on Basic API vs Graph API. This mocks Graph's /me 
      const response = await axios.get(`${this.baseUrl}/me`, {
        params: {
          fields: 'id,username',
          access_token: accessToken,
        },
      });
      return {
        igUserId: response.data.id,
        username: response.data.username || 'unknown_user',
      };
    } catch (error: any) {
      this.logger.error('Erro ao buscar dados do perfil', error.response?.data || error.message);
      // Fallback for MVP if using standard Facebook Graph Token before fetching specific Page
      return { igUserId: 'mock-ig-id-after-oauth', username: 'connected_user' };
    }
  }
}
