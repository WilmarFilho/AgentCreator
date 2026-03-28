import { Module } from '@nestjs/common';
import { FactoryController } from './factory.controller';
import { FactoryService } from './factory.service';
import { SupabaseService } from '../supabase.service';
import { OpenaiService } from '../openai.service';

@Module({
  controllers: [FactoryController],
  providers: [FactoryService, SupabaseService, OpenaiService],
})
export class FactoryModule {}
