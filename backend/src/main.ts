import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
  });
  // Fayl hajmi limitini oshiramiz
  app.use(require('express').json({ limit: '100mb' }));
  app.use(require('express').urlencoded({ limit: '100mb', extended: true }));

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // CORS (frontend uchun) — FRONTEND_URL env orqali production domenini qo'shamiz
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    ...(process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',').map((u) => u.trim()).filter(Boolean)
      : []),
  ];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Dev: local uploads static fayl serveri (global prefix DAN OLDIN bo'lishi kerak)
  const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  // PDF va rasmlar uchun himoya headerlari
  app.use('/uploads', (req: any, res: any, next: any) => {
    // Yuklab olishni taqiqlash
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Cache — token bilan faqat shu brauzer ko'ra olsin
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    next();
  });
  app.use('/uploads', require('express').static(uploadsDir));

  // Global prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 Server ishlamoqda: http://localhost:${port}/api`);
}

bootstrap();
