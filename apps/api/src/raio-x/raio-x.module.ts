import { Module } from '@nestjs/common';
import { RaioXController } from './raio-x.controller';
import { RaioXService } from './raio-x.service';
import { SupabaseService } from '../supabse/supabase.service';
import { InstagramService } from '../apify/instagram.service';
import { OpenaiService } from '../openai/openai.service';
import { MediaProcessorService } from './media-processor.service';

@Module({
  controllers: [RaioXController],
  providers: [RaioXService, SupabaseService, InstagramService, OpenaiService, MediaProcessorService],
  exports: [RaioXService],
})
export class RaioXModule { }
