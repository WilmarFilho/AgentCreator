import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ApifyClient } from 'apify-client';

export interface CarouselChild {
  id: string;
  media_type: 'IMAGE' | 'VIDEO';
  media_url: string;
}

export interface InstagramPost {
  id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  caption: string;
  children?: CarouselChild[];
  timestamp: string;
  media_url?: string;
  permalink?: string;
  metrics: {
    likes: number;
    comments: number;
    saved: number;
    views: number;
    shares: number;
    reach: number;
    profile_visits: number;
  };
}

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);
  private readonly baseUrl = 'https://graph.facebook.com/v19.0';
  private apifyClient: ApifyClient | null = null;

  constructor(private configService: ConfigService) {
    const apifyToken = this.configService.get<string>('APIFY_API_TOKEN');
    if (apifyToken) {
      this.apifyClient = new ApifyClient({ token: apifyToken });
      this.logger.log('Apify Client initialized explicitly.');
    } else {
      this.logger.warn('APIFY_API_TOKEN not found. Scraper functionality will be disabled or mocked.');
    }
  }

  /**
   * Fetches user posts with pagination support.
   * Instagram Graph API returns max 25 per page, so we paginate to get up to `limit`.
   */
  async fetchUserPosts(igUserId: string, accessToken: string, limit: number = 15): Promise<InstagramPost[]> {
    this.logger.debug(`🎯 Buscando EXATAMENTE ${limit} posts (Imagens/Carrosséis) para o IG: ${igUserId}...`);

    const validPosts: InstagramPost[] = [];
    let url: string | null = `${this.baseUrl}/${igUserId}/media`;

    try {
      // O loop continua enquanto não enchermos o balde E houver páginas para ler
      while (url && validPosts.length < limit) {
        const response: any = await axios.get(url, {
          params: {
            fields: 'id,caption,media_type,media_url,timestamp,like_count,comments_count,permalink',
            access_token: accessToken,
            limit: 20,
          },
        });

        if (!response.data?.data) break;

        // 1. Filtramos apenas o que interessa desta página específica
        const filteredFromPage = response.data.data.filter(
          (item: any) => item.media_type === 'IMAGE' || item.media_type === 'CAROUSEL_ALBUM'
        );

        // 2. Processamos os insights apenas para esses que passaram no filtro
        // E garantimos que não vamos processar mais do que o necessário para completar o limite
        const neededCount = limit - validPosts.length;
        const toProcess = filteredFromPage.slice(0, neededCount);

        const processedPosts: InstagramPost[] = await Promise.all(
          toProcess.map(async (post: any) => {
            const insightData = await this.getPostInsights(post.id, accessToken);

            return {
              id: post.id,
              media_type: post.media_type,
              caption: post.caption || '',
              timestamp: post.timestamp,
              media_url: post.media_url,
              permalink: post.permalink,
              metrics: {
                likes: Number(post.like_count) || 0,
                comments: Number(post.comments_count) || 0,
                saved: insightData.saved,
                views: insightData.views,
                shares: insightData.shares,
                reach: insightData.reach,
                profile_visits: insightData.profile_visits,
              },
            };
          })
        );

        // 3. Adicionamos ao nosso balde principal
        validPosts.push(...processedPosts);

        // 4. Atualizamos a URL para a próxima página de scroll do Instagram
        url = response.data.paging?.next || null;

        this.logger.debug(`Status da coleta: ${validPosts.length}/${limit} posts válidos encontrados...`);
      }

      this.logger.log(`✅ Coleta finalizada com ${validPosts.length} posts (Imagens/Carrosséis).`);
      return validPosts;

    } catch (error: any) {
      this.logger.error('Erro crítico na coleta de posts filtrados', error.message);
      throw error;
    }
  }

  async getPostInsights(postId: string, accessToken: string): Promise<{ saved: number, views: number, shares: number, reach: number, profile_visits: number }> {
    try {
      const response = await axios.get(`${this.baseUrl}/${postId}/insights`, {
        params: {
          metric: 'views,saved,shares,reach,profile_visits',
          access_token: accessToken,
        },
      });

      const data = response.data.data;
      const getVal = (name: string) => data.find((m: any) => m.name === name)?.values[0]?.value || 0;

      return {
        saved: getVal('saved'),
        views: getVal('views'),
        shares: getVal('shares'),
        reach: getVal('reach'),
        profile_visits: getVal('profile_visits'),
      };
    } catch (error) {
      this.logger.error(`Insights fail for ${postId}: ${error.response?.data?.error?.message || error.message}`);
      return { saved: 0, views: 0, shares: 0, reach: 0, profile_visits: 0 };
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

      const token = response.data.access_token;
      this.logger.log('Access token successfully exchanged.');
      return token;
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
