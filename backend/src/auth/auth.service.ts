import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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

    return {
      success: true,
      message: 'SMS yuborildi',
      // Dev rejimda kodni qaytaramiz
      ...(process.env.NODE_ENV !== 'production' && { code }),
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

    // JWT token yaratamiz
    const token = this.jwt.sign({
      sub: user.id,
      phone: user.phone,
      role: user.role,
    });

    return {
      access_token: token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
      },
    };
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
        createdAt: true,
      },
    });

    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');
    return user;
  }
}
