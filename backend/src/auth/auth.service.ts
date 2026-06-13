import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EskizService } from './eskiz.service';
import { SendOtpDto, VerifyOtpDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private eskiz: EskizService,
  ) {}

  // JWT token + user obyektini bitta joydan qaytaramiz
  private buildAuthResponse(user: {
    id: number;
    phone: string;
    name: string | null;
    role: string;
  }) {
    const token = this.jwt.sign({
      sub: user.id,
      phone: user.phone,
      role: user.role,
    });
    return {
      access_token: token,
      user: { id: user.id, phone: user.phone, name: user.name, role: user.role },
    };
  }

  // ─── Telegram Mini App ─────────────────────────────────────────────────────
  // initData ni bot token bilan tasdiqlash (Telegram WebApp algoritmi)
  private verifyTelegramInitData(initData: string): {
    id: number;
    username?: string;
    first_name?: string;
  } {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new BadRequestException('Telegram bot sozlanmagan');

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) throw new UnauthorizedException("Telegram ma'lumoti noto'g'ri");

    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(token)
      .digest();
    const computed = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computed !== hash) {
      throw new UnauthorizedException('Telegram imzosi tasdiqlanmadi');
    }

    // auth_date eskirgan bo'lsa rad etamiz (24 soat)
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    if (authDate && Date.now() / 1000 - authDate > 86400) {
      throw new UnauthorizedException('Telegram sessiyasi eskirgan');
    }

    const userRaw = params.get('user');
    if (!userRaw) throw new UnauthorizedException('Telegram foydalanuvchisi yo\'q');
    const tgUser = JSON.parse(userRaw);
    return {
      id: tgUser.id,
      username: tgUser.username,
      first_name: tgUser.first_name,
    };
  }

  // Mini App login: initData tasdiqlanadi, telegramId bo'yicha user topiladi
  async telegramAuth(initData: string) {
    const tg = this.verifyTelegramInitData(initData);
    const user = await this.prisma.user.findUnique({
      where: { telegramId: BigInt(tg.id) },
    });
    if (user) {
      return this.buildAuthResponse(user);
    }
    // Hali bog'lanmagan — botda telefon ulashish kerak
    return {
      needsPhone: true,
      telegram: { id: tg.id, name: tg.first_name || tg.username || '' },
    };
  }

  // 1. SMS kod yuborish
  async sendOtp(dto: SendOtpDto) {
    // Eski ishlatilmagan kodlarni o'chiramiz
    await this.prisma.otpCode.deleteMany({
      where: { phone: dto.phone, used: false },
    });

    // 6 xonali random kod
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 daqiqa

    await this.prisma.otpCode.create({
      data: {
        phone: dto.phone,
        code,
        expiresAt,
      },
    });

    const message = `TestHub: tasdiqlash kodi ${code}. 3 daqiqa ichida kiriting.`;
    await this.eskiz.sendSms(dto.phone, message);

    // Eskiz (SMS) sozlanmagan bo'lsa — kodni response'da qaytaramiz (test rejim)
    const smsConfigured = !!process.env.ESKIZ_EMAIL;

    return {
      success: true,
      message: 'SMS yuborildi',
      // Dev rejimda YOKI SMS sozlanmagan bo'lsa kodni qaytaramiz
      ...((process.env.NODE_ENV !== 'production' || !smsConfigured) && { code }),
    };
  }

  // 2. OTP tekshirish va JWT qaytarish
  async verifyOtp(dto: VerifyOtpDto) {
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        phone: dto.phone,
        code: dto.code,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otp) {
      throw new UnauthorizedException("Kod noto'g'ri yoki muddati o'tgan");
    }

    // Kodni ishlatilgan deb belgilaymiz
    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { used: true },
    });

    // Foydalanuvchini topamiz yoki yaratamiz
    let user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: { phone: dto.phone },
      });
    }

    return this.buildAuthResponse(user);
  }

  // Bot orqali telefon ulashilganda: telegramId ni telefon akkountiga bog'laymiz
  // (mavjud bo'lsa yangilaymiz, bo'lmasa yaratamiz)
  async linkTelegramByPhone(
    telegramId: number,
    phone: string,
    name?: string,
    username?: string,
  ) {
    // Telefon raqamni normallashtiramiz (+ bilan)
    const normalized = phone.startsWith('+') ? phone : `+${phone}`;
    const tgId = BigInt(telegramId);

    // Bu telegramId allaqachon boshqa akkountga bog'langan bo'lsa — uni uzamiz
    const existingByTg = await this.prisma.user.findUnique({
      where: { telegramId: tgId },
    });
    if (existingByTg && existingByTg.phone !== normalized) {
      await this.prisma.user.update({
        where: { id: existingByTg.id },
        data: { telegramId: null },
      });
    }

    const byPhone = await this.prisma.user.findUnique({
      where: { phone: normalized },
    });

    if (byPhone) {
      return this.prisma.user.update({
        where: { id: byPhone.id },
        data: {
          telegramId: tgId,
          telegramUsername: username || byPhone.telegramUsername,
          name: byPhone.name || name || null,
        },
      });
    }

    return this.prisma.user.create({
      data: {
        phone: normalized,
        name: name || null,
        telegramId: tgId,
        telegramUsername: username || null,
      },
    });
  }

  // 3. JWTdan foydalanuvchini olish
  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        name: true,
        role: true,
        groupId: true,
        group: { select: { id: true, name: true } },
        createdAt: true,
      },
    });

    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');
    return user;
  }
}
