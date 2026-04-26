import { Controller, Post, Get, Param, Body, HttpCode } from '@nestjs/common';
import { FactoryService } from './factory.service';

export class GenerateCarouselDto {
    profileId: string;
    topicId: string;
    templateId: string;
}

export class GenerateSlideImageDto {
  prompt: string;
  templateStyle?: string;
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

  @Post('image')
  async generateSlideImage(@Body() dto: GenerateSlideImageDto) {
    return await this.factoryService.generateSlideImage(dto.prompt, dto.templateStyle);
  }

  @Post('pinterest-references')
  async getPinterestReferences(@Body() dto: GenerateSlideImageDto) {
    return await this.factoryService.getPinterestReferences(dto.prompt, dto.templateStyle);
  }
}
