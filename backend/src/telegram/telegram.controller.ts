import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { TelegramService } from './telegram.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('telegram')
export class TelegramController {
  constructor(private telegramService: TelegramService) {}

  // Webhook endpoint (Telegram dan keladi — token bilan himoyalanadi)
  @Post('webhook')
  handleWebhook(@Body() body: any) {
    return this.telegramService.handleWebhook(body);
  }

  // Quyidagilar faqat admin uchun
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')

  @Get('videos/:testId')
  getVideos(@Param('testId', ParseIntPipe) testId: number) {
    return this.telegramService.getVideosByTest(testId);
  }

  @Post('videos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  setVideo(@Body() body: { testId: number; questionNo: number; fileId: string }) {
    return this.telegramService.setVideoFileId(body.testId, body.questionNo, body.fileId);
  }

  @Delete('videos/:testId/:questionNo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  removeVideo(
    @Param('testId', ParseIntPipe) testId: number,
    @Param('questionNo', ParseIntPipe) questionNo: number,
  ) {
    return this.telegramService.removeVideo(testId, questionNo);
  }

  // Foydalanuvchilar uchun — video stream proxy (bot token yashirin qoladi)
  @Get('stream/:fileId')
  @UseGuards(JwtAuthGuard)
  async streamVideo(
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    return this.telegramService.streamVideo(fileId, res);
  }

  @Post('webhook/set')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  setWebhook(@Body() body: { url: string }) {
    return this.telegramService.setWebhook(body.url);
  }

  // Kanaldan eski postlarni olish va saqlash
  @Post('sync-channel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  syncChannel(@Body() body: { chatId: string }) {
    return this.telegramService.syncChannelVideos(body.chatId);
  }

  // getUpdates orqali oxirgi videolarni ko'rish (manual)
  @Get('updates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  getUpdates() {
    return this.telegramService.getRecentUpdates();
  }
}
