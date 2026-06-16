import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

// MUHIM: @napi-rs/canvas — native kutubxona. Uni faylning tepasida import qilsak
// va Render'da yuklanmasa, BUTUN backend ishga tushmay qoladi. Shuning uchun
// faqat reyting rasmi chizilayotganda lazy require qilamiz (xato bo'lsa ham server tirik qoladi).

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly baseUrl: string;
  private lastUpdateId = 0;
  private pollInterval: NodeJS.Timeout | null = null;
  private rankingInterval: NodeJS.Timeout | null = null;
  private rankingTick = false; // bir vaqtning o'zida ikki marta ishlamasligi uchun
  private fontsRegistered = false;
  private canvasLib: any = undefined; // undefined = hali urinilmagan; null = yuklanmadi

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

    // Dedlayn tugagan guruhlarga avtomatik reyting yuborish — har 60 soniyada tekshiramiz
    this.rankingInterval = setInterval(() => {
      this.sendDueRankings().catch((e) =>
        this.logger.warn(`Avto-reyting xatosi: ${e?.message}`),
      );
    }, 60 * 1000);
  }

  onModuleDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.rankingInterval) clearInterval(this.rankingInterval);
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
          allowed_updates: ['message', 'channel_post', 'edited_message', 'edited_channel_post'],
        },
        timeout: 8000,
      });
      const updates: any[] = res.data?.result || [];
      for (const upd of updates) {
        if (upd.update_id > this.lastUpdateId) this.lastUpdateId = upd.update_id;
        const msg = upd.channel_post || upd.edited_channel_post || upd.message || upd.edited_message;
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

    // Prefiks endi raqam yoki harf-raqam bo'lishi mumkin: "101:5", "AT1:1", "SB2-3"
    const match = caption.match(/^v?([A-Za-z0-9]+)\s*[:–\-]\s*(\d+)/i);
    if (!match) {
      this.logger.debug(`Video keldi (caption noto'g'ri format): ${fileId} | "${caption}"`);
      return;
    }

    const token = match[1];
    const questionNo = parseInt(match[2]);

    const testId = await this.resolveTestIdFromToken(token);
    if (testId) {
      await this.setVideoFileId(testId, questionNo, fileId);
      this.logger.log(`✅ [${chatTitle}] "${token}" → test=${testId} savol=${questionNo} saqlandi`);
      return;
    }

    this.logger.warn(`⚠️ [${chatTitle}] test/variant topilmadi: "${caption}" | fileId: ${fileId}`);
  }

  // Caption prefiksini (token) testga bog'laymiz: telegramId → variantNo → DB id
  private async resolveTestIdFromToken(token: string): Promise<number | null> {
    // 1. telegramId orqali (foydalanuvchi o'zi belgilagan — eng aniq, harf ham bo'lishi mumkin)
    const byTelegramId = await this.prisma.test.findFirst({
      where: { telegramId: { equals: token, mode: 'insensitive' } },
    });
    if (byTelegramId) return byTelegramId.id;

    // Token sof raqam bo'lsa — variantNo / DB id bo'yicha ham qidiramiz
    if (/^\d+$/.test(token)) {
      const num = parseInt(token);
      // 2. variantNo orqali (foydalanuvchilar variant raqamida o'ylaydi)
      const byVariant = await this.prisma.test.findFirst({
        where: { variantNo: num },
        orderBy: { id: 'asc' },
      });
      if (byVariant) return byVariant.id;

      // 3. DB test id orqali (oxirgi variant)
      const byId = await this.prisma.test.findUnique({ where: { id: num } });
      if (byId) return byId.id;
    }

    return null;
  }

  // Video file_id ni savolga biriktirish
  async setVideoFileId(testId: number, questionNo: number, fileId: string) {
    // Caption tahrirlangan bo'lsa — shu file boshqa joyga bog'langan bo'lsa olib tashlaymiz
    // (xato ID yozib keyin to'g'rilaganda video ko'chadi, ikki joyda turmaydi)
    await this.prisma.videoSolution.deleteMany({
      where: { fileId, NOT: { testId, questionNo } },
    });
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
      // channel_post = kanaldan kelgan xabarlar; edited_* = tahrirlanganlar
      allowed_updates: ['message', 'channel_post', 'edited_message', 'edited_channel_post'],
    });
    return res.data;
  }

  // Webhook orqali kelgan xabarni qayta ishlash (polling bilan bir xil logika)
  async handleWebhook(body: any) {
    // 1) Kanal posti (yangi yoki tahrirlangan) — video yechimlar
    const channelMsg = body?.channel_post || body?.edited_channel_post;
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
    const msg = body?.message || body?.edited_message;
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

  // ─── Guruhda testni ishlamaganlar ro'yxati ──────────────────────────────────
  async getNonCompleters(testId: number, groupId: number) {
    const members = await this.prisma.user.findMany({
      where: { groupId },
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' },
    });
    const completed = await this.prisma.attempt.findMany({
      where: { testId, status: { not: 'IN_PROGRESS' }, user: { groupId } },
      select: { userId: true },
    });
    const doneSet = new Set(completed.map((a) => a.userId));
    return members.filter((m) => !doneSet.has(m.id));
  }

  // ─── Kuratorga ishlamaganlar ro'yxatini yuborish ────────────────────────────
  async notifyCurator(testId: number, groupId: number) {
    const [test, group] = await Promise.all([
      this.prisma.test.findUnique({ where: { id: testId }, select: { title: true } }),
      this.prisma.group.findUnique({
        where: { id: groupId },
        select: { name: true, telegramChatId: true, curatorId: true, curator: { select: { telegramId: true } } },
      }),
    ]);
    if (!group) return { ok: false, message: 'Guruh topilmadi' };
    // Avval guruh chatiga, bo'lmasa zaxira sifatida kurator shaxsiy chatiga
    const target = group.telegramChatId || (group.curator?.telegramId ? String(group.curator.telegramId) : null);
    if (!target) {
      return { ok: false, message: "Guruh Telegram chati ulanmagan (yoki kurator bog'lanmagan)" };
    }

    const pending = await this.getNonCompleters(testId, groupId);
    const lines = pending.length
      ? pending.map((u, i) => `${i + 1}. ${u.name || u.phone}`).join('\n')
      : '✅ Barcha a\'zolar testni ishladi!';

    const text =
      `📋 «${test?.title || 'Test'}» — ${group.name}\n\n` +
      `Ishlamaganlar (${pending.length}):\n${lines}`;

    await this.sendMessage(Number(target), text);
    return { ok: true, count: pending.length };
  }

  // ─── Guruh reytingi (rasm) ───────────────────────────────────────────────────
  // @napi-rs/canvas ni xavfsiz (lazy) yuklash — yuklanmasa null qaytaradi, server qulamaydi
  private loadCanvas(): any {
    if (this.canvasLib !== undefined) return this.canvasLib;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.canvasLib = require('@napi-rs/canvas');
    } catch (e: any) {
      this.logger.warn(`@napi-rs/canvas yuklanmadi (reyting rasmi o'chiq): ${e?.message}`);
      this.canvasLib = null;
    }
    return this.canvasLib;
  }

  // Shriftlarni bir marta ro'yxatdan o'tkazamiz (Render'da tizim shrifti bo'lmasligi mumkin)
  private ensureFonts(lib: any) {
    if (this.fontsRegistered || !lib?.GlobalFonts) return;
    try {
      const dir = path.join(process.cwd(), 'assets', 'fonts');
      const regular = path.join(dir, 'DejaVuSans.ttf');
      const bold = path.join(dir, 'DejaVuSans-Bold.ttf');
      if (fs.existsSync(regular)) lib.GlobalFonts.register(fs.readFileSync(regular), 'THSans');
      if (fs.existsSync(bold)) lib.GlobalFonts.register(fs.readFileSync(bold), 'THSansBold');
    } catch (e: any) {
      this.logger.warn(`Shrift yuklanmadi: ${e?.message}`);
    }
    this.fontsRegistered = true;
  }

  // Guruh a'zolarining test natijalarini hisoblash (eng yaxshi urinish bo'yicha)
  async getGroupRanking(testId: number, groupId: number) {
    const [test, group, members, tg] = await Promise.all([
      this.prisma.test.findUnique({ where: { id: testId }, select: { title: true } }),
      this.prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
      this.prisma.user.findMany({
        where: { groupId },
        select: { id: true, name: true, phone: true },
      }),
      this.prisma.testGroup.findUnique({
        where: { testId_groupId: { testId, groupId } },
        select: { openedAt: true, startsAt: true },
      }),
    ]);

    // Faqat joriy oyna ichidagi urinishlar — qayta ochilganda eski natijalar aralashmasin
    const windowStart = tg ? (tg.startsAt ?? tg.openedAt) : undefined;
    const attempts = await this.prisma.attempt.findMany({
      where: {
        testId,
        status: { not: 'IN_PROGRESS' },
        user: { groupId },
        ...(windowStart ? { startedAt: { gte: windowStart } } : {}),
      },
      select: { userId: true, score: true },
    });
    const bestByUser = new Map<number, number>();
    for (const a of attempts) {
      const s = a.score ?? 0;
      if (!bestByUser.has(a.userId) || s > (bestByUser.get(a.userId) as number)) {
        bestByUser.set(a.userId, s);
      }
    }

    const rows = members.map((m) => ({
      name: m.name || m.phone || 'Foydalanuvchi',
      score: bestByUser.has(m.id) ? Math.round(bestByUser.get(m.id) as number) : null,
      taken: bestByUser.has(m.id),
    }));
    // Ishlaganlar — balli bo'yicha kamayish tartibida; ishlamaganlar oxirida
    rows.sort((a, b) => {
      if (a.taken !== b.taken) return a.taken ? -1 : 1;
      return (b.score ?? 0) - (a.score ?? 0);
    });

    return {
      testTitle: test?.title || 'Test',
      groupName: group?.name || 'Guruh',
      rows,
    };
  }

  // Matnni kerakli kenglikka qisqartirish (uzun ismlar uchun)
  private fitText(ctx: any, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
    return t + '…';
  }

  // Reyting jadvalini PNG ko'rinishida chizish (canvas yuklanmasa null qaytaradi)
  private renderRankingImage(data: {
    testTitle: string;
    groupName: string;
    rows: { name: string; score: number | null; taken: boolean }[];
  }): Buffer | null {
    const lib = this.loadCanvas();
    if (!lib?.createCanvas) return null;
    const createCanvas = lib.createCanvas;
    this.ensureFonts(lib);
    const FONT = 'THSans';
    const BOLD = 'THSansBold';
    const W = 820;
    const padX = 28;
    const headerH = 132;
    const rowH = 58;
    const rows = data.rows;
    const H = headerH + rows.length * rowH + 28;

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // Fon
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, W, H);

    // Sarlavha paneli (gradient)
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#4f46e5');
    grad.addColorStop(1, '#7c3aed');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, headerH);

    ctx.fillStyle = '#ffffff';
    ctx.font = `30px ${BOLD}`;
    ctx.fillText('Reyting jadvali', padX, 48);
    ctx.font = `20px ${BOLD}`;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(this.fitText(ctx, data.testTitle, W - padX * 2), padX, 82);
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(this.fitText(ctx, `${data.groupName}`, W - padX * 2), padX, 110);

    const medal = ['#fcd34d', '#cbd5e1', '#f59e0b']; // oltin / kumush / bronza
    let rank = 0;

    rows.forEach((r, i) => {
      const y = headerH + i * rowH;
      // Qator foni
      ctx.fillStyle = i % 2 === 0 ? '#111c30' : '#0e1626';
      ctx.fillRect(0, y, W, rowH);

      const cy = y + rowH / 2;

      // O'rin belgisi
      const badgeX = padX + 18;
      if (r.taken) {
        rank += 1;
        const color = rank <= 3 ? medal[rank - 1] : '#334155';
        ctx.beginPath();
        ctx.arc(badgeX, cy, 16, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.fillStyle = rank <= 3 ? '#1f2937' : '#e2e8f0';
        ctx.font = `16px ${BOLD}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(rank), badgeX, cy + 1);
      } else {
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(badgeX, cy, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#64748b';
        ctx.font = `16px ${BOLD}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('–', badgeX, cy + 1);
      }

      // Ism
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `19px ${r.taken ? BOLD : FONT}`;
      ctx.fillStyle = r.taken ? '#e2e8f0' : '#64748b';
      const nameX = badgeX + 28;
      ctx.fillText(this.fitText(ctx, r.name, W - nameX - 150), nameX, cy + 1);

      // Ball / holat (o'ngda)
      ctx.textAlign = 'right';
      if (r.taken) {
        const s = r.score ?? 0;
        const sc = s >= 60 ? '#10b981' : s >= 40 ? '#f59e0b' : '#ef4444';
        ctx.font = `22px ${BOLD}`;
        ctx.fillStyle = sc;
        ctx.fillText(`${s}%`, W - padX, cy + 1);
      } else {
        ctx.font = `15px ${FONT}`;
        ctx.fillStyle = '#64748b';
        ctx.fillText('ishlamagan', W - padX, cy + 1);
      }
      ctx.textAlign = 'left';
    });

    return canvas.toBuffer('image/png');
  }

  // Telegram'ga rasm yuborish (multipart)
  async sendPhoto(chatId: number, image: Buffer, caption?: string) {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    if (caption) form.append('caption', caption);
    form.append('photo', new Blob([new Uint8Array(image)], { type: 'image/png' }), 'reyting.png');
    await axios.post(`${this.baseUrl}/sendPhoto`, form);
  }

  // Guruh reytingini rasm sifatida kuratorga yuborish
  async sendRankingImage(testId: number, groupId: number) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { name: true, telegramChatId: true, curator: { select: { telegramId: true } } },
    });
    if (!group) return { ok: false, message: 'Guruh topilmadi' };
    // Avval guruh chatiga, bo'lmasa zaxira sifatida kurator shaxsiy chatiga
    const target = group.telegramChatId || (group.curator?.telegramId ? String(group.curator.telegramId) : null);
    if (!target) {
      return { ok: false, message: "Guruh Telegram chati ulanmagan (yoki kurator bog'lanmagan)" };
    }

    const ranking = await this.getGroupRanking(testId, groupId);
    if (ranking.rows.length === 0) {
      return { ok: false, message: "Guruhda a'zolar yo'q" };
    }

    const taken = ranking.rows.filter((r) => r.taken).length;
    const chatId = Number(target);
    const header = `🏆 ${ranking.testTitle}\n${ranking.groupName} — reyting (${taken}/${ranking.rows.length} ishladi)`;

    if (Number.isNaN(chatId)) {
      return { ok: false, message: `Chat ID noto'g'ri: "${target}"` };
    }

    try {
      const image = this.renderRankingImage(ranking);
      let rank = 0;
      const lines = ranking.rows
        .map((r) =>
          r.taken
            ? `${(rank += 1)}. ${r.name} — ${r.score}%`
            : `–. ${r.name} — ishlamagan`,
        )
        .join('\n');
      if (image) {
        await this.sendPhoto(chatId, image, header);
        return { ok: true, count: taken, mode: 'image' };
      }
      // Rasm chizilmasa (canvas yo'q) — matn ko'rinishida yuboramiz
      await this.sendMessageOrThrow(chatId, `${header}\n\n${lines}`);
      return { ok: true, count: taken, mode: 'text' };
    } catch (e: any) {
      // Telegram API asl sababni "description" da qaytaradi
      const desc = e?.response?.data?.description || e?.message || 'nomalum';
      this.logger.error(`Reyting yuborilmadi (chat=${chatId}): ${desc}`);
      return { ok: false, message: `Telegram: ${desc}` };
    }
  }

  // Dedlayni tugagan, lekin reyting yuborilmagan guruhlarni topib avtomatik yuborish
  async sendDueRankings() {
    if (this.rankingTick) return; // oldingi tekshiruv hali tugamagan bo'lsa o'tkazib yuboramiz
    this.rankingTick = true;
    try {
      const now = new Date();
      const due = await this.prisma.testGroup.findMany({
        where: {
          endsAt: { not: null, lte: now },
          rankingSentAt: null,
          test: { type: 'TOPIC' },
        },
        select: { id: true, testId: true, groupId: true },
        take: 20,
      });
      for (const tg of due) {
        let res: { ok: boolean; message?: string } | null = null;
        try {
          res = await this.sendRankingImage(tg.testId, tg.groupId);
        } catch (e: any) {
          this.logger.warn(`Avto-reyting yuborilmadi (tg=${tg.id}): ${e?.message}`);
        }
        // Faqat muvaffaqiyatli yoki qayta urinish foydasiz holatlarda belgilaymiz.
        // Chat ulanmagan / bot guruhda yo'q bo'lsa — belgilamaymiz, keyin qayta urinadi
        // (admin chat ID kiritgach yoki botni guruhga qo'shgach o'zi yuboriladi).
        const permanent =
          res?.message === "Guruhda a'zolar yo'q" || res?.message === 'Guruh topilmadi';
        if (res?.ok || permanent) {
          await this.prisma.testGroup.update({
            where: { id: tg.id },
            data: { rankingSentAt: new Date() },
          });
        }
      }
    } finally {
      this.rankingTick = false;
    }
  }

  // Oddiy matnli xabar (xatoni yutadi — fon jarayonlar uchun)
  async sendMessage(chatId: number, text: string) {
    try {
      await axios.post(`${this.baseUrl}/sendMessage`, { chat_id: chatId, text });
    } catch (e: any) {
      this.logger.warn(`sendMessage xato (${chatId}): ${e?.message}`);
    }
  }

  // Matnli xabar — xato bo'lsa otadi (chaqiruvchi asl sababni bilishi uchun)
  private async sendMessageOrThrow(chatId: number, text: string) {
    await axios.post(`${this.baseUrl}/sendMessage`, { chat_id: chatId, text });
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
      const match = caption.match(/^v?([A-Za-z0-9]+)\s*[:–-]\s*(\d+)/i);
      if (match) {
        const questionNo = parseInt(match[2]);
        const testId = await this.resolveTestIdFromToken(match[1]);
        if (testId) {
          await this.setVideoFileId(testId, questionNo, video.file_id);
          saved.push({ testId, questionNo, fileId: video.file_id });
        } else {
          skipped.push({ fileId: video.file_id, caption });
        }
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
