import { Module } from '@nestjs/common';
import { StudioController } from './studio.controller';
import { StudioService } from './studio.service';
import { SupabaseService } from '../supabse/supabase.service';
import { OpenaiService } from '../openai/openai.service';
import { NewsService } from './news.service';
import { InstagramService } from '../apify/instagram.service';

@Module({
  controllers: [StudioController],
  providers: [StudioService, SupabaseService, OpenaiService, NewsService, InstagramService],
})
export class StudioModule { }
