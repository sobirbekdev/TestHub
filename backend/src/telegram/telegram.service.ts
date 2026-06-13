import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly baseUrl: string;
  private lastUpdateId = 0;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
  ) {
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  // Mini App ochiladigan manzil (sayt)
  private get miniAppUrl(): string {
    return (process.env.MINI_APP_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
  }

  // Dastur ishga tushganda: productionda webhook, lokalda polling
  async onModuleInit() {
    if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN === 'your-bot-token') return;

    // Render avtomatik RENDER_EXTERNAL_URL beradi; yoki TELEGRAM_WEBHOOK_URL qo'lda
    const publicUrl = process.env.TELEGRAM_WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL;

    if (publicUrl) {
      // WEBHOOK rejimi — Render bepul tarifi uxlab qolsa ham Telegram qayta yuboradi
      const webhookUrl = `${publicUrl.replace(/\/$/, '')}/api/telegram/webhook`;
      try {
        await this.setWebhook(webhookUrl);
        this.logger.log(`🤖 Telegram webhook o'rnatildi: ${webhookUrl}`);
        // Menyu tugmasini Mini App'ga sozlaymiz (xato bo'lsa ham davom etamiz)
        await this.setMenuButton().catch((e) =>
          this.logger.warn(`Menyu tugmasi o'rnatilmadi: ${e?.message}`),
        );
      } catch (e: any) {
        this.logger.error(`Webhook o'rnatilmadi, polling'ga o'tamiz: ${e?.message}`);
        this.startPolling();
      }
    } else {
      // Lokal dev — webhook URL yo'q, polling ishlatamiz
      this.startPolling();
    }
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

    // 1. telegramId orqali qidirish (foydalanuvchi o'zi belgilagan — eng aniq)
    const byTelegramId = await this.prisma.test.findUnique({ where: { telegramId: firstNum } });
    if (byTelegramId) {
      await this.setVideoFileId(byTelegramId.id, questionNo, fileId);
      this.logger.log(`✅ [${chatTitle}] telegramId=${firstNum} → test=${byTelegramId.id} (${byTelegramId.title}) savol=${questionNo} saqlandi`);
      return;
    }

    // 2. variantNo orqali qidirish (foydalanuvchilar variant raqamida o'ylaydi,
    //    masalan "6:3" = 6-variant — shuning uchun DB id dan OLDIN tekshiriladi)
    const byVariant = await this.prisma.test.findFirst({
      where: { variantNo: firstNum },
      orderBy: { id: 'asc' },
    });
    if (byVariant) {
      await this.setVideoFileId(byVariant.id, questionNo, fileId);
      this.logger.log(`✅ [${chatTitle}] variant=${firstNum} → test=${byVariant.id} (${byVariant.title}) savol=${questionNo} saqlandi`);
      return;
    }

    // 3. DB test id orqali qidirish (oxirgi variant)
    const test = await this.prisma.test.findUnique({ where: { id: firstNum } });
    if (test) {
      await this.setVideoFileId(firstNum, questionNo, fileId);
      this.logger.log(`✅ [${chatTitle}] test id=${firstNum} (${test.title}) savol=${questionNo} saqlandi`);
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

  // Webhook orqali kelgan xabarni qayta ishlash (polling bilan bir xil logika)
  async handleWebhook(body: any) {
    // 1) Kanal posti — video yechimlar
    const channelMsg = body?.channel_post;
    if (channelMsg) {
      const video = channelMsg.video || channelMsg.document;
      if (video) {
        await this.processVideoMessage(
          video.file_id,
          channelMsg.caption || '',
          channelMsg.chat?.title || '',
        );
      }
      return { ok: true };
    }

    // 2) Shaxsiy xabar — bot bilan suhbat (/start, telefon ulashish)
    const msg = body?.message;
    if (msg && msg.chat?.type === 'private') {
      await this.handlePrivateMessage(msg).catch((e) =>
        this.logger.error(`Private xabar xatosi: ${e?.message}`),
      );
      return { ok: true };
    }

    // 3) Guruh/kanaldan video kelsa (oddiy message ko'rinishida)
    if (msg) {
      const video = msg.video || msg.document;
      if (video) {
        await this.processVideoMessage(video.file_id, msg.caption || '', msg.chat?.title || '');
      }
    }
    return { ok: true };
  }

  // ─── Bot suhbati: foydalanuvchi bilan ────────────────────────────────────────
  private async handlePrivateMessage(msg: any) {
    const chatId = msg.chat.id;
    const from = msg.from || {};

    // Telefon ulashildi — akkountni bog'laymiz
    if (msg.contact && msg.contact.phone_number) {
      // Faqat o'z kontaktini ulashishi mumkin (boshqa odamniki emas)
      if (msg.contact.user_id && msg.contact.user_id !== from.id) {
        await this.sendMessage(chatId, "Iltimos o'zingizning raqamingizni ulashing.");
        return;
      }
      const name = [from.first_name, from.last_name].filter(Boolean).join(' ');
      await this.auth.linkTelegramByPhone(
        from.id,
        msg.contact.phone_number,
        name,
        from.username,
      );
      await this.sendOpenAppButton(
        chatId,
        `✅ Raqamingiz ulandi!\nEndi pastdagi tugma orqali testlarni boshlang.`,
      );
      return;
    }

    const text: string = msg.text || '';
    if (text.startsWith('/start')) {
      // Allaqachon bog'langan bo'lsa — to'g'ridan-to'g'ri ilovani ochish tugmasi
      const linked = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(from.id) },
      });
      if (linked) {
        await this.sendOpenAppButton(
          chatId,
          `Xush kelibsiz, ${linked.name || ''}! 🎓\nTestlarni boshlash uchun tugmani bosing.`,
        );
      } else {
        await this.askPhone(chatId);
      }
      return;
    }

    // Boshqa har qanday matn — yo'riqnoma
    await this.sendMessage(
      chatId,
      "TestHub botiga xush kelibsiz!\n/start buyrug'ini yuboring.",
    );
  }

  // Telefon raqam so'rovchi tugma
  private async askPhone(chatId: number) {
    await axios.post(`${this.baseUrl}/sendMessage`, {
      chat_id: chatId,
      text:
        "TestHub'ga xush kelibsiz! 🎓\n\nDavom etish uchun telefon raqamingizni ulashing — bu sizni akkountingizga bog'laydi.",
      reply_markup: {
        keyboard: [[{ text: '📱 Telefon raqamni ulashish', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  // Mini App ochish tugmasi
  private async sendOpenAppButton(chatId: number, text: string) {
    const url = this.miniAppUrl;
    if (!url) {
      await this.sendMessage(chatId, text + '\n\n(Ilova manzili sozlanmagan)');
      return;
    }
    await axios.post(`${this.baseUrl}/sendMessage`, {
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[{ text: '🚀 Testlarni ochish', web_app: { url } }]],
      },
    });
  }

  // Oddiy matnli xabar
  async sendMessage(chatId: number, text: string) {
    try {
      await axios.post(`${this.baseUrl}/sendMessage`, { chat_id: chatId, text });
    } catch (e: any) {
      this.logger.warn(`sendMessage xato (${chatId}): ${e?.message}`);
    }
  }

  // Bot menyu tugmasini Mini App'ga sozlash
  async setMenuButton() {
    const url = this.miniAppUrl;
    if (!url) return;
    await axios.post(`${this.baseUrl}/setChatMenuButton`, {
      menu_button: {
        type: 'web_app',
        text: 'Testlar',
        web_app: { url },
      },
    });
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
