import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ResumeService } from './resume.service';

@Controller('api/v1/resumes')
export class ResumeController {
  constructor(private resumeService: ResumeService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Req() req: any, @Body() body: { title: string; language?: string }) {
    return this.resumeService.create(req.user.userId, body);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  list(@Req() req: any) {
    return this.resumeService.list(req.user.userId);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  get(@Req() req: any, @Param('id') id: string) {
    return this.resumeService.get(req.user.userId, id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Req() req: any, @Param('id') id: string, @Body() body: { title?: string; status?: string }) {
    return this.resumeService.update(req.user.userId, id, body as any);
  }

  @Post(':id/duplicate')
  @UseGuards(AuthGuard('jwt'))
  duplicate(@Req() req: any, @Param('id') id: string) {
    return this.resumeService.duplicate(req.user.userId, id);
  }

  @Post(':id/archive')
  @UseGuards(AuthGuard('jwt'))
  archive(@Req() req: any, @Param('id') id: string) {
    return this.resumeService.archive(req.user.userId, id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  delete(@Req() req: any, @Param('id') id: string) {
    return this.resumeService.delete(req.user.userId, id);
  }
}
