import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface CarouselChild {
  id: string;
  media_type: 'IMAGE' | 'VIDEO';
  media_url: string;
}

export interface InstagramPost {
  id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  caption: string;
  timestamp: string;
  media_url?: string;
  children?: CarouselChild[];
}

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);
  private readonly baseUrl = 'https://graph.facebook.com/v19.0';

  constructor() { }

  /**
   * Fetches user posts with pagination support.
   * Instagram Graph API returns max 25 per page, so we paginate to get up to `limit`.
   */
  async fetchUserPosts(igUserId: string, accessToken: string, limit: number = 30): Promise<InstagramPost[]> {
    this.logger.debug(`Fetching up to ${limit} posts from Instagram for IG User: ${igUserId}...`);
    const allPosts: InstagramPost[] = [];
    let url: string | null = `${this.baseUrl}/${igUserId}/media`;
    const perPage = Math.min(limit, 25); // API max per request

    try {
      while (url && allPosts.length < limit) {
        const response: any = await axios.get(url, {
          params: {
            fields: 'id,caption,media_type,media_url,timestamp',
            access_token: accessToken,
            limit: perPage,
          },
        });

        if (!response.data || !response.data.data) {
          throw new Error('Invalid response from Instagram API');
        }

        const posts: InstagramPost[] = response.data.data.map((post: any) => ({
          id: post.id,
          media_type: post.media_type,
          caption: post.caption || '',
          timestamp: post.timestamp,
          media_url: post.media_url || undefined,
        }));

        allPosts.push(...posts);

        // Check for next page cursor
        url = response.data.paging?.next || null;
        this.logger.debug(`Fetched ${allPosts.length} posts so far... (has next page: ${!!url})`);
      }

      // Trim to exact limit
      const result = allPosts.slice(0, limit);
      this.logger.debug(`Fetched ${result.length} posts total.`);
      return result;
    } catch (error: any) {
      this.logger.error('Failed to fetch Instagram posts', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Fetches individual slides (children) of a Carousel Album post.
   */
  async fetchCarouselChildren(mediaId: string, accessToken: string): Promise<CarouselChild[]> {
    this.logger.debug(`Fetching carousel children for media ${mediaId}...`);
    try {
      const response = await axios.get(`${this.baseUrl}/${mediaId}/children`, {
        params: {
          fields: 'id,media_type,media_url',
          access_token: accessToken,
        },
      });

      if (!response.data || !response.data.data) {
        this.logger.warn(`No children data for carousel ${mediaId}`);
        return [];
      }

      const children: CarouselChild[] = response.data.data.map((child: any) => ({
        id: child.id,
        media_type: child.media_type,
        media_url: child.media_url,
      }));

      this.logger.debug(`Fetched ${children.length} slides for carousel ${mediaId}`);
      return children;
    } catch (error: any) {
      this.logger.error(`Failed to fetch carousel children for ${mediaId}`, error.response?.data || error.message);
      return [];
    }
  }

  getAuthorizationUrl(profileId: string): string {
    const appId = process.env.FACEBOOK_APP_ID;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
    if (!appId || !redirectUri) {
      this.logger.error('Meta OAuth env variables missing');
      throw new Error('OAuth não configurado corretamente no backend.');
    }

    const state = Buffer.from(JSON.stringify({ profileId })).toString('base64');
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
