import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly baseUrl: string;
  private lastUpdateId = 0;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(private prisma: PrismaService) {
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  // Dastur ishga tushganda polling boshlaydi
  onModuleInit() {
    if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN === 'your-bot-token') return;
    this.startPolling();
  }

  onModuleDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  private startPolling() {
    this.logger.log('🤖 Telegram polling boshlandi (har 5 soniya)');
    this.pollInterval = setInterval(() => this.poll(), 5000);
  }

  private async poll() {
    try {
      const res = await axios.get(`${this.baseUrl}/getUpdates`, {
        params: {
          offset: this.lastUpdateId + 1,
          limit: 50,
          timeout: 0,
          allowed_updates: ['message', 'channel_post'],
        },
        timeout: 8000,
      });
      const updates: any[] = res.data?.result || [];
      for (const upd of updates) {
        if (upd.update_id > this.lastUpdateId) this.lastUpdateId = upd.update_id;
        const msg = upd.channel_post || upd.message;
        if (!msg) continue;
        const video = msg.video || msg.document;
        if (!video) continue;
        await this.processVideoMessage(video.file_id, msg.caption || '', msg.chat?.title || '');
      }
    } catch {
      // Tarmoq xatosi — keyingi sikl qayta urinadi
    }
  }

  private async processVideoMessage(fileId: string, caption: string, chatTitle: string) {
    if (!caption) return;

    // Format 1: "testId:savolNo" — masalan "80:3"
    // Format 2: "v6:3" yoki "v6-3" — variantNo:savolNo (kolleksiyani avtomatik topadi)
    // Format 3: "6:3" — variantNo:savolNo (Format 1 bilan bir xil ko'rinsa ham kichik raqam = variant deb qabul qilinadi)

    const match = caption.match(/^v?(\d+)\s*[:–\-]\s*(\d+)/i);
    if (!match) {
      this.logger.debug(`Video keldi (caption noto'g'ri format): ${fileId} | "${caption}"`);
      return;
    }

    const firstNum = parseInt(match[1]);
    const questionNo = parseInt(match[2]);

    // 1. telegramId orqali qidirish (foydalanuvchi o'zi belgilagan)
    const byTelegramId = await this.prisma.test.findUnique({ where: { telegramId: firstNum } });
    if (byTelegramId) {
      await this.setVideoFileId(byTelegramId.id, questionNo, fileId);
      this.logger.log(`✅ [${chatTitle}] telegramId=${firstNum} → test=${byTelegramId.id} (${byTelegramId.title}) savol=${questionNo} saqlandi`);
      return;
    }

    // 2. testId orqali qidirish
    const test = await this.prisma.test.findUnique({ where: { id: firstNum } });
    if (test) {
      await this.setVideoFileId(firstNum, questionNo, fileId);
      this.logger.log(`✅ [${chatTitle}] test=${firstNum} (${test.title}) savol=${questionNo} saqlandi`);
      return;
    }

    // 3. variantNo orqali qidirish
    const byVariant = await this.prisma.test.findFirst({
      where: { variantNo: firstNum },
      orderBy: { id: 'asc' },
    });
    if (byVariant) {
      await this.setVideoFileId(byVariant.id, questionNo, fileId);
      this.logger.log(`✅ [${chatTitle}] variant=${firstNum} → test=${byVariant.id} (${byVariant.title}) savol=${questionNo} saqlandi`);
      return;
    }

    this.logger.warn(`⚠️ [${chatTitle}] test/variant topilmadi: "${caption}" | fileId: ${fileId}`);
  }

  // Video file_id ni savolga biriktirish
  async setVideoFileId(testId: number, questionNo: number, fileId: string) {
    return this.prisma.videoSolution.upsert({
      where: { testId_questionNo: { testId, questionNo } },
      create: { testId, questionNo, fileId },
      update: { fileId },
    });
  }

  // Test uchun barcha video file_id larni olish
  async getVideosByTest(testId: number) {
    return this.prisma.videoSolution.findMany({
      where: { testId },
      orderBy: { questionNo: 'asc' },
    });
  }

  // Bitta videoni o'chirish
  async removeVideo(testId: number, questionNo: number) {
    return this.prisma.videoSolution.deleteMany({
      where: { testId, questionNo },
    });
  }

  // Bot webhook o'rnatish
  async setWebhook(webhookUrl: string) {
    const res = await axios.post(`${this.baseUrl}/setWebhook`, {
      url: webhookUrl,
      // channel_post = kanaldan kelgan xabarlar
      allowed_updates: ['message', 'channel_post'],
    });
    return res.data;
  }

  // Webhook orqali kelgan xabarni qayta ishlash
  async handleWebhook(body: any) {
    // Kanal posti yoki oddiy xabar
    const msg = body?.channel_post || body?.message;
    if (!msg) return { ok: true };

    const video = msg.video || msg.document;
    if (!video) return { ok: true };

    const fileId: string = video.file_id;
    const caption: string = msg.caption || '';

    // Caption formati: "testId:savolNo" → masalan "12:5"
    // Yoki "12:5 - biror izoh" ham bo'lishi mumkin
    const match = caption.match(/^(\d+)\s*[:–-]\s*(\d+)/);
    if (match) {
      const testId = parseInt(match[1]);
      const questionNo = parseInt(match[2]);
      await this.setVideoFileId(testId, questionNo, fileId);
      this.logger.log(`✅ Avtomatik saqlandi: test=${testId}, savol=${questionNo}, fileId=${fileId}`);
      return { ok: true, saved: { testId, questionNo } };
    }

    // Caption yo'q yoki format to'g'ri emas — file_id ni logga yozamiz
    this.logger.log(`📥 Video keldi (caption yo'q/noto'g'ri): ${fileId} | caption: "${caption}"`);
    return { ok: true, fileId };
  }

  // getUpdates orqali oxirgi videolarni olish
  async getRecentUpdates() {
    const res = await axios.get(`${this.baseUrl}/getUpdates`, {
      params: { limit: 100, allowed_updates: ['message', 'channel_post'] },
    });
    const updates = res.data?.result || [];
    const videos: any[] = [];
    for (const upd of updates) {
      const msg = upd.channel_post || upd.message;
      if (!msg) continue;
      const video = msg.video || msg.document;
      if (!video) continue;
      videos.push({
        updateId: upd.update_id,
        fileId: video.file_id,
        caption: msg.caption || '',
        date: msg.date,
        chatTitle: msg.chat?.title || msg.chat?.username || '',
      });
    }
    return { total: videos.length, videos };
  }

  // Kanaldan barcha video postlarni sync qilish
  async syncChannelVideos(chatId: string) {
    const res = await axios.get(`${this.baseUrl}/getUpdates`, {
      params: { limit: 100, allowed_updates: ['channel_post'] },
    });
    const updates = res.data?.result || [];
    const saved: any[] = [];
    const skipped: any[] = [];

    for (const upd of updates) {
      const msg = upd.channel_post;
      if (!msg || msg.chat?.id?.toString() !== chatId.toString()) continue;
      const video = msg.video || msg.document;
      if (!video) continue;

      const caption = msg.caption || '';
      const match = caption.match(/^(\d+)\s*[:–-]\s*(\d+)/);
      if (match) {
        const testId = parseInt(match[1]);
        const questionNo = parseInt(match[2]);
        await this.setVideoFileId(testId, questionNo, video.file_id);
        saved.push({ testId, questionNo, fileId: video.file_id });
      } else {
        skipped.push({ fileId: video.file_id, caption });
      }
    }
    return { saved: saved.length, skipped: skipped.length, savedList: saved, skippedList: skipped };
  }

  // Telegram faylni frontend'ga stream qilish (bot token yashirin)
  async streamVideo(fileId: string, res: any) {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN || '';
      // 1. file_path ni olish
      const fileRes = await axios.get(`${this.baseUrl}/getFile`, {
        params: { file_id: fileId },
      });
      const filePath: string = fileRes.data?.result?.file_path;
      if (!filePath) { res.status(404).json({ message: 'Fayl topilmadi' }); return; }

      // 2. Telegram CDN dan stream qilish
      const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
      const videoRes = await axios.get(fileUrl, { responseType: 'stream' });

      const contentType = videoRes.headers['content-type'] || 'video/mp4';
      const contentLength = videoRes.headers['content-length'];
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      videoRes.data.pipe(res);
    } catch (e: any) {
      this.logger.error('streamVideo error', e?.message);
      if (!res.headersSent) res.status(500).json({ message: 'Video yuklanmadi' });
    }
  }
}
