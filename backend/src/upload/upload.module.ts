import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { PdfProxyController } from './pdf-proxy.controller';
import { UploadService } from './upload.service';

@Module({
  controllers: [UploadController, PdfProxyController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
