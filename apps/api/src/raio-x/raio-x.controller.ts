import { Body, Controller, Post, Get, Query, Redirect, HttpCode } from '@nestjs/common';
import { RaioXService } from './raio-x.service';

export class StartAnalysisDto {
  profileId: string;
  handle: string;
  accessToken: string;
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
    );
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
  @Redirect('http://localhost:3000/dashboard/raio-x?success=true')
  async facebookCallback(@Query('code') code: string, @Query('state') state: string) {
    if (!code || !state) {
      throw new Error('Invalid OAuth parameters');
    }
    
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('ascii'));
      if (!decoded.profileId) throw new Error('No profileId in state');
      
      await this.raioXService.handleOauthCallback(code, decoded.profileId);
    } catch (e: any) {
      console.error(e);
      // Fail loudly or silently redirect to error. For now, redirect to dashboard error state
      return { url: 'http://localhost:3000/dashboard/raio-x?error=oauth_failed' };
    }
  }
}
