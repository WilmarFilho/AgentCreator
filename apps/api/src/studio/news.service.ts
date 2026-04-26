import { Injectable, Logger } from '@nestjs/common';
import { InstagramService } from '../apify/instagram.service';
import { NewsArticle, NormalizedPersona } from './studio.types';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(private readonly instagramService: InstagramService) { }

  async getRecentNewsForPersona(persona: NormalizedPersona): Promise<NewsArticle[]> {
    this.logger.log(`Collecting source captions from @notjournal.ai for niche ${persona.nicho_principal}`);

    const posts = await this.instagramService.fetchPublicProfileCaptions('notjournal.ai', 3, 40);

    return posts.map((post, index) => ({
      title: this.extractTitleFromCaption(post.caption, index + 1),
      summary: post.caption,
      link: post.permalink || `https://www.instagram.com/notjournal.ai/`,
      source: 'Instagram @notjournal.ai',
      sourceUrl: post.permalink || 'https://www.instagram.com/notjournal.ai/',
      publishedAt: post.timestamp,
    }));
  }

  private extractTitleFromCaption(caption: string, fallbackIndex: number): string {
    const cleaned = caption
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .find((line) => line.length > 15) || caption.trim();

    const title = cleaned
      .replace(/^#+\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();

    return title.slice(0, 120) || `Insight ${fallbackIndex} do @notjournal.ai`;
  }
}
