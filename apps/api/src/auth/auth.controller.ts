import { Controller, Post, Get, Body, Req, UseGuards, Res, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string }) {
    return this.authService.register(body.email, body.password);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 300000 } }) // 5 attempts per 5 min
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('whatsapp/send')
  async sendWhatsAppOtp(@Body() body: { phone: string }) {
    return this.authService.sendWhatsAppOtp(body.phone);
  }

  @Post('whatsapp/verify')
  async verifyWhatsAppOtp(@Body() body: { phone: string; otp: string }) {
    return this.authService.verifyWhatsAppOtp(body.phone, body.otp);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const tokens = await this.authService.oAuthLogin({
      provider: 'google',
      email: req.user.emails?.[0]?.value,
      name: req.user.displayName,
      photoUrl: req.user.photos?.[0]?.value,
    });
    res.redirect(`/?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`);
  }

  @Get('linkedin')
  @UseGuards(AuthGuard('linkedin'))
  linkedinAuth() {
    // Guard redirects to LinkedIn
  }

  @Get('linkedin/callback')
  @UseGuards(AuthGuard('linkedin'))
  async linkedinCallback(@Req() req: any, @Res() res: Response) {
    const tokens = await this.authService.oAuthLogin({
      provider: 'linkedin',
      email: req.user.emails?.[0]?.value,
      name: req.user.displayName,
    });
    res.redirect(`/?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`);
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshAccessToken(body.refreshToken);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  async logout(@Req() req: any, @Body() body: { refreshToken?: string }) {
    await this.authService.logout(req.user.userId, body.refreshToken);
    return { message: 'Logged out' };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@Req() req: any) {
    return this.authService.getCurrentUser(req.user.userId);
  }
}
