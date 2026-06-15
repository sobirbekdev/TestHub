import { Controller, Get, Query, Res, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';

// PDF proksi — pdf.js (Android) uchun CORS bilan PDF beradi.
// Faqat o'zimizning R2/uploads manbalariga ruxsat (SSRF himoyasi).
@Controller('upload')
export class PdfProxyController {
  @Get('pdf')
  async proxyPdf(@Query('url') url: string, @Res() res: Response) {
    if (!url) throw new BadRequestException('url kerak');

    const allowed = [
      process.env.R2_PUBLIC_URL,
      process.env.BACKEND_URL,
      'http://localhost:4000/uploads',
    ].filter(Boolean) as string[];

    if (!allowed.some((a) => url.startsWith(a))) {
      throw new BadRequestException('Ruxsat etilmagan manba');
    }

    try {
      const upstream = await axios.get(url, { responseType: 'stream' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      const len = upstream.headers['content-length'];
      if (typeof len === 'string' || typeof len === 'number') {
        res.setHeader('Content-Length', len);
      }
      upstream.data.pipe(res);
    } catch {
      if (!res.headersSent) res.status(502).json({ message: 'PDF yuklanmadi' });
    }
  }
}
