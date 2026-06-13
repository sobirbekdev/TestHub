import {
  Controller, Post, Body, UseGuards, UseInterceptors,
  UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private uploadService: UploadService) {}

  // POST /api/upload/presigned — frontend uchun presigned URL
  @Post('presigned')
  getPresigned(@Body() body: { fileName: string; mimeType: string }) {
    return this.uploadService.getPresignedUrl(body.fileName, body.mimeType);
  }

  // POST /api/upload/file — to'g'ridan-to'g'ri yuklash
  @Post('file')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100_000_000 } })) // 100MB
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fayl topilmadi');
    const url = await this.uploadService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
    return { url };
  }
}
