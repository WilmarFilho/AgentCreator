import { Controller, Post, Get, Param, Body, HttpCode } from '@nestjs/common';
import { FactoryService } from './factory.service';

export class GenerateCarouselDto {
    profileId: string;
    topicId: string;
    templateId: string;
}

@Controller('api/factory')
export class FactoryController {
  constructor(private readonly factoryService: FactoryService) {}

  @Post('generate')
  @HttpCode(202)
  async generate(@Body() dto: GenerateCarouselDto) {
    return await this.factoryService.generateCarousel(dto.profileId, dto.topicId, dto.templateId);
  }

  @Get('carousel/:id')
  async getCarousel(@Param('id') id: string) {
    return await this.factoryService.getCarousel(id);
  }
}
