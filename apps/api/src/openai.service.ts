import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

export interface PersonaResult {
  primary_goal: 'sales' | 'authority' | 'growth';
  content_niche: string;
  tone_of_voice: string;
  psychological_profile: string;
  visual_preferences: Record<string, string>;
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

  async analyzePersona(posts: string[]): Promise<PersonaResult> {
    this.logger.log('Analyzing persona based on posts...');
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

  async generateCarousel(topic: string, templateContext: string, persona: PersonaResult): Promise<any> {
    this.logger.log(`Generating carousel content for topic: ${topic}`);
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a world-class Instagram copywriter. Create a 5-10 slide carousel script about the provided topic.
The template context defines the visual style, make sure the text fits that style.
IMPORTANT: The 'main_caption' and 'copy_text' MUST be written in Brazilian Portuguese (pt-BR). The 'ai_image_prompt' should remain in English to be used with Midjourney.
Respond ONLY with a valid JSON format following this exact structure:
{
  "main_caption": "The Instagram caption to go along with the post, including hashtags (in pt-BR)",
  "slides": [
    {
      "order": 1,
      "copy_text": "The exact text to appear on the slide (in pt-BR)",
      "ai_image_prompt": "A prompt to generate an evocative background image for this slide based on the text (midjourney style, in English)"
    }
  ]
}`,
          },
          {
            role: 'user',
            content: `Topic:\n${topic}\n\nPersona Context:\nNiche: ${persona.content_niche}\nTone: ${persona.tone_of_voice}\n\nTemplate Context:\n${templateContext}`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No content');
      
      return JSON.parse(content);
    } catch (error) {
      this.logger.error('Error generating carousel', error);
      throw error;
    }
  }
}
