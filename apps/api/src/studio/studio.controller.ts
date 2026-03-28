import { Controller, Get, Query } from '@nestjs/common';
import { StudioService } from './studio.service';

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
}
