import { Module } from '@nestjs/common';
import { StudioController } from './studio.controller';
import { StudioService } from './studio.service';
import { SupabaseService } from '../supabase.service';
import { OpenaiService } from '../openai.service';

@Module({
  controllers: [StudioController],
  providers: [StudioService, SupabaseService, OpenaiService],
})
export class StudioModule {}
