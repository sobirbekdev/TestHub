import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class EskizService {
  private readonly logger = new Logger(EskizService.name);
  private token: string | null = null;
  private tokenExpiry: number = 0;

  private async getToken(): Promise<string> {
    // Token 29 daqiqa amal qiladi
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    const res = await axios.post('https://notify.eskiz.uz/api/auth/login', {
      email: process.env.ESKIZ_EMAIL,
      password: process.env.ESKIZ_PASSWORD,
    });

    this.token = res.data.data.token;
    this.tokenExpiry = Date.now() + 29 * 60 * 1000;
    return this.token;
  }

  async sendSms(phone: string, message: string): Promise<boolean> {
    // Development rejimida SMS yubormaymiz
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`[DEV] SMS → ${phone}: ${message}`);
      return true;
    }

    try {
      const token = await this.getToken();
      // Telefon raqamdan + ni olib tashlaymiz
      const mobilePhone = phone.replace('+', '');

      await axios.post(
        'https://notify.eskiz.uz/api/message/sms/send',
        {
          mobile_phone: mobilePhone,
          message,
          from: '4546',
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      return true;
    } catch (error) {
      this.logger.error(`SMS yuborishda xatolik: ${error.message}`);
      return false;
    }
  }
}
