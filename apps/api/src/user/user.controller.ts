import { Controller, Get, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserService } from './user.service';

@Controller('api/v1/users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@Req() req: any) {
    return this.userService.getProfile(req.user.userId);
  }

  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  updateProfile(@Req() req: any, @Body() body: { fullName?: string; phone?: string; photoUrl?: string; languagePreference?: string }) {
    return this.userService.updateProfile(req.user.userId, body);
  }

  @Get('me/sessions')
  @UseGuards(AuthGuard('jwt'))
  listSessions(@Req() req: any) {
    return this.userService.listSessions(req.user.userId);
  }

  @Delete('me/sessions/:tokenId')
  @UseGuards(AuthGuard('jwt'))
  revokeSession(@Req() req: any, @Param('tokenId') tokenId: string) {
    return this.userService.revokeSession(req.user.userId, tokenId);
  }

  @Delete('me')
  @UseGuards(AuthGuard('jwt'))
  deleteAccount(@Req() req: any) {
    return this.userService.deleteAccount(req.user.userId);
  }
}
