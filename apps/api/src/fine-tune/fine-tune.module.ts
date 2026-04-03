import { Module } from '@nestjs/common';
import { FineTuneController } from './fine-tune.controller';
import { FineTuneService } from './fine-tune.service';
import { SupabaseService } from '../supabase.service';
import { OpenaiService } from '../openai.service';

@Module({
  controllers: [FineTuneController],
  providers: [FineTuneService, SupabaseService, OpenaiService]
})
export class FineTuneModule {}
