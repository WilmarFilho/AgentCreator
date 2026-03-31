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
    const scope = 'business_management,pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights';

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

  async getAvailableIgAccounts(accessToken: string): Promise<{ igUserId: string; username: string; pageName: string }[]> {
    this.logger.debug('Fetching Facebook Pages to find all Instagram Business Accounts...');
    try {
      const pagesRes = await axios.get(`${this.baseUrl}/me/accounts`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,access_token,instagram_business_account'
        },
      });

      const pages = pagesRes.data.data;
      if (!pages || pages.length === 0) {
        throw new Error('Nenhuma página do Facebook encontrada para este usuário.');
      }
      this.logger.debug(`Found ${pages.length} pages: ${pages.map((p: any) => p.name).join(', ')}`);

      const availableAccounts: { igUserId: string; username: string; pageName: string }[] = [];

      for (const page of pages) {
        const pageId = page.id;
        const pageToken = page.access_token;
        let igUserId: string | null = null;

        try {
          const igRes = await axios.get(`${this.baseUrl}/${pageId}`, {
            params: {
              fields: 'instagram_business_account',
              access_token: pageToken,
            },
          });

          if (igRes.data.instagram_business_account) {
            igUserId = igRes.data.instagram_business_account.id;
            this.logger.debug(`Found Instagram Business Account ID: ${igUserId} on Page: ${page.name}`);
            
            // Get Instagram Profile username
            const profileRes = await axios.get(`${this.baseUrl}/${igUserId}`, {
              params: {
                fields: 'username',
                access_token: pageToken || accessToken,
              },
            });

            availableAccounts.push({
              igUserId: igUserId as string,
              username: profileRes.data.username || 'unknown_user',
              pageName: page.name
            });
          }
        } catch (pageErr: any) {
          this.logger.warn(`Failed to fetch IG Business Account for page ${pageId}`, pageErr.response?.data || pageErr.message);
        }
      }

      if (availableAccounts.length === 0) {
        throw new Error('Nenhuma conta do Instagram Business/Creator associada a estas páginas.');
      }

      return availableAccounts;
    } catch (error: any) {
      this.logger.error('Erro ao buscar contas do Instagram', error.response?.data || error.message);
      throw error;
    }
  }
}
