import { Controller, Post, Get, Body, Req, UseGuards, Res } from '@nestjs/common';
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
  async login(@Body() body: { email: string; password: string }, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(body.email, body.password);
    setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post('whatsapp/send')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 per hour per IP
  async sendWhatsAppOtp(@Body() body: { phone: string }) {
    return this.authService.sendWhatsAppOtp(body.phone);
  }

  @Post('whatsapp/verify')
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 per 15 min
  async verifyWhatsAppOtp(@Body() body: { phone: string; otp: string }, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.verifyWhatsAppOtp(body.phone, body.otp);
    setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
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
    setRefreshCookie(res, tokens.refreshToken);
    res.redirect(`/dashboard?accessToken=${tokens.accessToken}`);
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
    setRefreshCookie(res, tokens.refreshToken);
    res.redirect(`/dashboard?accessToken=${tokens.accessToken}`);
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken?: string }, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const tokenId = body.refreshToken || req.cookies?.refreshToken;
    if (!tokenId) {
      res.status(401).json({ message: 'Refresh token required' });
      return;
    }
    const tokens = await this.authService.refreshAccessToken(tokenId);
    setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  async logout(@Req() req: any, @Body() body: { refreshToken?: string }, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.user.userId, body.refreshToken);
    res.clearCookie('refreshToken', { path: '/', httpOnly: true, secure: true, sameSite: 'lax' });
    return { message: 'Logged out' };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@Req() req: any) {
    return this.authService.getCurrentUser(req.user.userId);
  }
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}
