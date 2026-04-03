import { Controller, Post, Res, HttpException, HttpStatus } from '@nestjs/common';
import { FineTuneService } from './fine-tune.service';
import type { Response } from 'express';

@Controller('fine-tune')
export class FineTuneController {
  constructor(private readonly fineTuneService: FineTuneService) { }

  @Post('export-jsonl')
  async exportJsonl(@Res() res: Response) {
    try {
      const jsonlData = await this.fineTuneService.generateJsonlDataset();

      res.setHeader('Content-Type', 'application/jsonl');
      res.setHeader('Content-Disposition', 'attachment; filename=training_data.jsonl');
      return res.send(jsonlData);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('trigger-training')
  async triggerTraining() {
    return this.fineTuneService.triggerOpenAIFineTune();
  }
}
