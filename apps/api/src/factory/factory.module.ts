import { Module } from '@nestjs/common';
import { FactoryController } from './factory.controller';
import { FactoryService } from './factory.service';
import { SupabaseService } from '../supabse/supabase.service';
import { OpenaiService } from '../openai/openai.service';

@Module({
  controllers: [FactoryController],
  providers: [FactoryService, SupabaseService, OpenaiService],
})
export class FactoryModule { }
