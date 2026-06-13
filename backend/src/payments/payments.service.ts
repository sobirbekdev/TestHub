import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  // To'lov yaratish (foydalanuvchi "To'lov" bosganida)
  async create(userId: number, testId: number, provider: 'CLICK' | 'PAYME') {
    const test = await this.prisma.test.findUnique({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test topilmadi');
    if (test.price === 0) throw new BadRequestException('Bu test bepul');

    // Allaqachon to'langan bo'lsa
    const existing = await this.prisma.payment.findFirst({
      where: { userId, testId, status: 'PAID' },
    });
    if (existing) return { alreadyPaid: true, payment: existing };

    // DEV MODE: to'lovni avtomatik tasdiqlash
    const isDevMode = !process.env.CLICK_MERCHANT_ID || process.env.CLICK_MERCHANT_ID === 'MERCHANT_ID';
    if (isDevMode) {
      const payment = await this.prisma.payment.create({
        data: { userId, testId, amount: test.price, provider, status: 'PAID' },
      });
      return { payment, status: 'PAID' };
    }

    const payment = await this.prisma.payment.create({
      data: { userId, testId, amount: test.price, provider },
    });

    // To'lov URL yaratish
    const payUrl = this.buildPayUrl(provider, payment.id, test.price, test.title);
    return { payment, payUrl };
  }

  // Click callback
  async handleClickCallback(body: any) {
    const { merchant_trans_id, error } = body;
    const paymentId = parseInt(merchant_trans_id);

    if (error === 0) {
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'PAID', externalId: body.click_trans_id?.toString() },
      });
    } else {
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'FAILED' },
      });
    }

    return { error: 0, error_note: 'Success' };
  }

  // Payme callback
  async handlePaymeCallback(body: any) {
    const { method, params } = body;
    const id = body.id;

    if (method === 'PerformTransaction') {
      const paymentId = parseInt(params.account?.payment_id);
      await this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'PAID', externalId: params.id },
      });
      return {
        id,
        result: {
          transaction: params.id,
          perform_time: Date.now(),
          state: 2,
        },
      };
    }

    return { id, result: {} };
  }

  // To'lovlar tarixi
  async getHistory(userId: number) {
    return this.prisma.payment.findMany({
      where: { userId },
      include: { user: { select: { name: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Admin: barcha to'lovlar
  async getAll() {
    return this.prisma.payment.findMany({
      include: {
        user: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private buildPayUrl(
    provider: string,
    paymentId: number,
    amount: number,
    description: string,
  ): string {
    // Merchant akkaunti tayyor bo'lgach to'ldiriladi
    if (provider === 'CLICK') {
      const merchantId = process.env.CLICK_MERCHANT_ID || 'MERCHANT_ID';
      const serviceId = process.env.CLICK_SERVICE_ID || 'SERVICE_ID';
      return `https://my.click.uz/services/pay?service_id=${serviceId}&merchant_id=${merchantId}&amount=${amount / 100}&transaction_param=${paymentId}&return_url=${process.env.FRONTEND_URL}/payment/success`;
    }

    if (provider === 'PAYME') {
      const merchantId = process.env.PAYME_MERCHANT_ID || 'MERCHANT_ID';
      const encoded = Buffer.from(
        `m=${merchantId};ac.payment_id=${paymentId};a=${amount * 100}`,
      ).toString('base64');
      return `https://checkout.paycom.uz/${encoded}`;
    }

    return '';
  }
}
