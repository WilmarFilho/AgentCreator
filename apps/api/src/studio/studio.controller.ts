import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { StudioService } from './studio.service';

export class GenerateCopyPreviewDto {
  profileId: string;
  topicId: string;
}

@Controller('api/studio')
export class StudioController {
  constructor(private readonly studioService: StudioService) {}

  @Get('trends')
  async getTrends(@Query('profileId') profileId: string) {
    if (!profileId) {
      throw new Error('profileId query parameter is required');
    }
    return await this.studioService.getTrendsForProfile(profileId);
  }

  @Post('copy-preview')
  async generateCopyPreview(@Body() dto: GenerateCopyPreviewDto) {
    return await this.studioService.generateCopyPreview(dto.profileId, dto.topicId);
  }
}
