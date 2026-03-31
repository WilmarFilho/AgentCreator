import { Body, Controller, Post, Get, Query, Redirect, HttpCode, Res } from '@nestjs/common';
import { Response } from 'express';
import { RaioXService } from './raio-x.service';

export class StartAnalysisDto {
  profileId: string;
  handle: string;
  accessToken: string;
  igUserId: string;
}

@Controller('api/raio-x')
export class RaioXController {
  constructor(private readonly raioXService: RaioXService) {}

  @Post('start')
  @HttpCode(202)
  async startAnalysis(@Body() dto: StartAnalysisDto) {
    return await this.raioXService.startAnalysis(
      dto.profileId,
      dto.handle,
      dto.accessToken,
      dto.igUserId
    );
  }

  @Get('accounts')
  async getAvailableAccounts(@Query('token') token: string) {
    if (!token) throw new Error('Token is required');
    return await this.raioXService.getAvailableAccounts(token);
  }

  @Get('oauth/facebook')
  @Redirect()
  async loginWithFacebook(@Query('profileId') profileId: string) {
    if (!profileId) {
      throw new Error('Profile ID missing');
    }
    const url = this.raioXService.getFacebookOauthUrl(profileId);
    return { url };
  }

  @Get('oauth/callback')
  async facebookCallback(
    @Query('code') code: string, 
    @Query('state') state: string,
    @Res() res: any
  ) {
    if (!code || !state) {
      throw new Error('Invalid OAuth parameters');
    }
    
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('ascii'));
      if (!decoded.profileId) throw new Error('No profileId in state');
      
      const token = await this.raioXService.handleOauthCallback(code, decoded.profileId);
      
      // Redirect to selection page
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/dashboard/raio-x?step=select_account&token=${token}`);

    } catch (e: any) {
      console.error(e);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/dashboard/raio-x?error=oauth_failed`);
    }
  }

  @Post('objectives')
  async saveObjectives(@Body() dto: { profileId: string; objectives: Record<string, string> }) {
    return await this.raioXService.saveObjectives(dto.profileId, dto.objectives);
  }

  @Get('objectives')
  async getObjectives(@Query('profileId') profileId: string) {
    if (!profileId) throw new Error('profileId is required');
    return await this.raioXService.getObjectives(profileId);
  }
}
