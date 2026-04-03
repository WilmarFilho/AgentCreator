import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ApifyClient } from 'apify-client';

export interface CarouselChild {
  id: string;
  media_type: 'IMAGE' | 'VIDEO';
  media_url: string;
}

interface CreatorDiscoveryOptions {
  postsPerHashtag?: number;
  topCreatorsPerCountry?: number;
  category?: 'lifestyle' | 'marketing' | 'tech'; // Exemplo de nicho
}

export interface InstagramPost {
  id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  caption: string;
  timestamp: string;
  media_url?: string;
  children?: CarouselChild[];
  like_count?: number;
  comments_count?: number;
  view_count?: number; // Fetched via Apify or Insights
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
   * Fetches the user profile and their posts from Apify to get real followers and view counts.
   */
  async fetchApifyData(username: string, limit: number = 15): Promise<{ followers: number; postMetrics: Record<string, any>; rawItems?: any[] }> {
    if (!this.apifyClient) {
      return { followers: 0, postMetrics: {} };
    }

    this.logger.log(`Starting Apify scrape for username: ${username}`);
    try {
      const run = await this.apifyClient.actor('apify/instagram-scraper').call({
        directUrls: [`https://www.instagram.com/${username}/`],
        resultsType: 'details',
        resultsLimit: limit,
      });

      const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();

      let followers = 0;
      const postMetrics: Record<string, any> = {};

      for (const item of items as any[]) {
        if (item.followersCount) {
          followers = item.followersCount;
        }
        if (item.id) {
          postMetrics[String(item.id)] = {
            viewCount: item.videoViewCount || item.viewCount || 0,
            likeCount: item.likesCount || 0,
            commentsCount: item.commentsCount || 0,
          };
        }
      }

      this.logger.log(`Apify scrape finished. Followers: ${followers}, Posts Scraped: ${Object.keys(postMetrics).length}`);
      return { followers, postMetrics, rawItems: items };
    } catch (error: any) {
      this.logger.error(`Apify fetch failed for ${username}`, error.message);
      return { followers: 0, postMetrics: {} };
    }
  }

  /**
   * Uses Apify Instagram Hashtag Scraper to discover top viral creators
   * across multiple countries/languages, ranked by engagement.
   *
   * Strategy: scrape trending hashtags per country → collect unique post authors
   * → rank by viralization factor (views + likes / followers) → return top N.
   */


  async discoverTopCreators(options: CreatorDiscoveryOptions = {}): Promise<{ username: string; country: string; score: number }[]> {
    // Capture locally so TypeScript keeps the non-null narrowing inside async callbacks
    const client = this.apifyClient;
    if (!client) {
      this.logger.warn('Apify not configured.');
      return [];
    }

    const { postsPerHashtag = 30, topCreatorsPerCountry = 3 } = options;

    // Hashtags por país/nicho — escolhidas para atrair criadores profissionais, não ruído
    const countryHashtags: Record<string, string[]> = {
      BR: ['empreendedorismo', 'marketingdigital'],
      US: ['contentstrategy', 'digitalmarketing'],
      IN: ['instagramgrowth', 'contentcreatorindia'],
      DE: ['onlinemarketing', 'contentcreator'],
      MX: ['marketingdigital', 'creadordecontenido'],
    };

    const creatorScores = new Map<string, { score: number; country: string; appearances: number }>();

    // Processamento paralelo por país para ganhar performance
    await Promise.all(Object.entries(countryHashtags).map(async ([country, hashtags]) => {
      const hashtag = hashtags[0];

      try {
        this.logger.log(`🔍 Scraping #${hashtag} for ${country}...`);

        const run = await client.actor('apify/instagram-hashtag-scraper').call({
          hashtags: [hashtag],
          resultsLimit: postsPerHashtag,
        });

        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (items.length > 0) {
          this.logger.debug(`Sample fields from #${hashtag}: ${Object.keys(items[0] as object).slice(0, 10).join(', ')}`);
        }

        for (const post of (items as any[])) {
          const username: string | undefined =
            post.ownerUsername || post.username || post.owner?.username || post.authorUsername;
          if (!username) continue;

          const likes: number = post.likesCount ?? post.likes_count ?? 0;
          const comments: number = post.commentsCount ?? post.comments_count ?? 0;
          const views: number = post.videoViewCount ?? post.video_view_count ?? post.viewCount ?? 0;

          // Fórmula de Engagement Power: Comentários valem muito mais (sinal de intenção)
          const engagementScore = (likes * 1) + (comments * 5) + (views * 0.1);

          const existing = creatorScores.get(username);
          if (!existing) {
            creatorScores.set(username, { score: engagementScore, country, appearances: 1 });
          } else {
            // Consistência = criador aparece em múltiplos posts. Soma o score.
            creatorScores.set(username, {
              score: existing.score + engagementScore,
              country: existing.country,
              appearances: existing.appearances + 1,
            });
          }
        }

        this.logger.log(`  ✅ #${hashtag} (${country}): ${items.length} posts, ${creatorScores.size} creators found so far.`);
      } catch (err: unknown) {
        this.logger.error(`❌ Error scraping #${hashtag} (${country}): ${err instanceof Error ? err.message : String(err)}`);
      }
    }));

    this.logger.log(`🏆 Total unique creators found: ${creatorScores.size}`);

    // Ranking final por país com boost de consistência
    return Object.keys(countryHashtags).flatMap(country =>
      Array.from(creatorScores.entries())
        .filter(([, data]) => data.country === country)
        .map(([username, data]) => ({
          username,
          country,
          score: Math.round(data.score * (1 + data.appearances * 0.2)),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topCreatorsPerCountry)
    );
  }
  /**
   * Fetches user posts with pagination support.
   * Instagram Graph API returns max 25 per page, so we paginate to get up to `limit`.
   */
  async fetchUserPosts(igUserId: string, accessToken: string, limit: number = 15): Promise<InstagramPost[]> {
    this.logger.debug(`Fetching up to ${limit} posts from Instagram for IG User: ${igUserId}...`);
    const allPosts: InstagramPost[] = [];
    let url: string | null = `${this.baseUrl}/${igUserId}/media`;
    const perPage = Math.min(limit, 25); // API max per request

    try {
      while (url && allPosts.length < limit) {
        const response: any = await axios.get(url, {
          params: {
            fields: 'id,caption,media_type,media_url,timestamp,like_count,comments_count',
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
          like_count: post.like_count || 0,
          comments_count: post.comments_count || 0,
          // Se o post for video, a Graph API oficial não retorna view_count no endpoint básico.
          // Deixamos como 0 para ser preenchido pela integração com APIFY no Raio-X.
          view_count: 0,
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
   * Fetches profile metrics, specifically follower count for Viralization Factor
   */
  async getProfileFollowerCount(igUserId: string, accessToken: string): Promise<number> {
    this.logger.debug(`Fetching profile metrics for IG User ${igUserId}`);
    try {
      // TODO: Apify Integration - fallback if official API doesn't allow parsing followers for standard user. Graph API usually returns followers_count for business profiles.
      const response = await axios.get(`${this.baseUrl}/${igUserId}`, {
        params: {
          fields: 'followers_count',
          access_token: accessToken,
        },
      });
      return response.data.followers_count || 1; // Return 1 to avoid division by zero
    } catch (error: any) {
      this.logger.warn(`Could not fetch followers_count officially. Relying on default or Apify Mock. Err: ${error.message}`);
      return 0; // Mocked fallback
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
