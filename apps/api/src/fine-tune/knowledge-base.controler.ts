import { Controller, Post, Res, HttpException, HttpStatus } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import type { Response } from 'express';

@Controller('knowledge-base')
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) { }

  @Post('export-knowledge-jsonl')
  async exportKnowledgeJsonl(@Res() res: Response) {
    try {
      const jsonlData = await this.knowledgeBaseService.generateKnowledgeJsonl();

      res.setHeader('Content-Type', 'application/jsonl');
      res.setHeader('Content-Disposition', 'attachment; filename=knowledge_data.jsonl');
      return res.send(jsonlData);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
