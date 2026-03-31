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
  private readonly baseUrl = 'https://graph.facebook.com/v19.0';

  constructor() { }

  async fetchUserPosts(igUserId: string, accessToken: string, limit: number = 20): Promise<InstagramPost[]> {
    this.logger.debug(`Fetching latest ${limit} posts from Instagram for IG User: ${igUserId}...`);
    try {
      // Instagram Graph API endpoint base for getting user media
      const response = await axios.get(`${this.baseUrl}/${igUserId}/media`, {
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

      this.logger.debug(`Fetched ${posts.length} posts successfully.`);
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

    // Scopes obrigatórios para a Graph API (Instagram Business/Creator)
    const scope = 'pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights';

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
    this.logger.debug('Fetching Facebook Pages to find Instagram Business Account...');
    try {
      // No passo 1 da função getIgProfileInfo
      const pagesRes = await axios.get(`${this.baseUrl}/me/accounts`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,access_token,instagram_business_account' // Peça o campo explicitamente
        },
      });

      // LOG DE DEPURAÇÃO:
      this.logger.debug(`Resposta bruta da Meta: ${JSON.stringify(pagesRes.data)}`);

      const pages = pagesRes.data.data;
      if (!pages || pages.length === 0) {
        throw new Error('Nenhuma página do Facebook encontrada para este usuário.');
      }
      this.logger.debug(`Found ${pages.length} pages: ${pages.map((p: any) => p.name).join(', ')}`);

      // 2. Find Instagram Business Account linked to one of these pages
      let igUserId: string | null = null;
      let pageAccessToken: string | null = null;

      for (const page of pages) {
        const pageId = page.id;
        const pageToken = page.access_token;

        try {
          const igRes = await axios.get(`${this.baseUrl}/${pageId}`, {
            params: {
              fields: 'instagram_business_account',
              access_token: pageToken,
            },
          });

          if (igRes.data.instagram_business_account) {
            igUserId = igRes.data.instagram_business_account.id;
            pageAccessToken = pageToken;
            this.logger.debug(`Found Instagram Business Account ID: ${igUserId} on Page: ${page.name}`);
            break;
          }
        } catch (pageErr: any) {
          this.logger.warn(`Failed to fetch IG Business Account for page ${pageId}`, pageErr.response?.data || pageErr.message);
        }
      }

      if (!igUserId) {
        throw new Error('Nenhuma conta do Instagram Business/Creator associada a estas páginas.');
      }

      // 3. Get Instagram Profile username (Using User access token usually works if we have instagram_basic scope)
      // Alternatively we could use the page access token which we obtained
      this.logger.debug(`Fetching profile info for IG Account: ${igUserId}`);
      const profileRes = await axios.get(`${this.baseUrl}/${igUserId}`, {
        params: {
          fields: 'username',
          access_token: pageAccessToken || accessToken,
        },
      });

      this.logger.debug(`Successfully fetched IG username: ${profileRes.data.username}`);

      return {
        igUserId,
        username: profileRes.data.username || 'unknown_user',
      };
    } catch (error: any) {
      this.logger.error('Erro ao buscar perfil do Instagram e Páginas', error.response?.data || error.message);
      throw error;
    }
  }
}
