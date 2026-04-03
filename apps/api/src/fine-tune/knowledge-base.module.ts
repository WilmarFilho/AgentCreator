import { Module } from '@nestjs/common';
import { KnowledgeBaseController } from './knowledge-base.controler';
import { KnowledgeBaseService } from './knowledge-base.service';
import { SupabaseService } from '../supabse/supabase.service';
import { OpenaiService } from '../openai/openai.service';

@Module({
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService, SupabaseService, OpenaiService]
})
export class KnowledgeBaseModule { }
