import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: { id: true, phone: true, name: true, role: true, groupId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { group: true, _count: { select: { attempts: true, payments: true } } },
    });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    return user;
  }

  async updateRole(id: number, role: Role) {
    return this.prisma.user.update({ where: { id }, data: { role } });
  }

  // Telefon raqami orqali xodim (kurator/o'qituvchi) qo'shish/tayinlash.
  // Mavjud bo'lsa rolini yangilaymiz, bo'lmasa yaratamiz.
  async createStaff(phone: string, role: Role, name?: string) {
    const normalized = phone.startsWith('+') ? phone : `+${phone}`;
    return this.prisma.user.upsert({
      where: { phone: normalized },
      update: { role, ...(name ? { name } : {}) },
      create: { phone: normalized, role, name: name || null },
      select: { id: true, phone: true, name: true, role: true, groupId: true },
    });
  }

  async updateName(id: number, name: string) {
    return this.prisma.user.update({
      where: { id },
      data: { name },
      select: { id: true, phone: true, name: true, role: true, groupId: true },
    });
  }

  // Foydalanuvchini butunlay o'chirish. FK cheklovlari uchun avval bog'liq
  // yozuvlarni (urinishlar, to'lovlar) o'chiramiz, kurator bo'lsa guruhlardan ajratamiz.
  async remove(id: number) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
      // Bog'liq yozuvlarni ketma-ket o'chiramiz (transaction'siz — interactive
      // transaction 5s limiti va boshqa muammolarni chetlab o'tish uchun).
      const attempts = await this.prisma.attempt.findMany({ where: { userId: id }, select: { id: true } });
      const attemptIds = attempts.map((a) => a.id);
      if (attemptIds.length) {
        await this.prisma.answer.deleteMany({ where: { attemptId: { in: attemptIds } } });
        await this.prisma.attempt.deleteMany({ where: { id: { in: attemptIds } } });
      }
      await this.prisma.payment.deleteMany({ where: { userId: id } });
      // otp_codes.phone → users.phone FK (ON DELETE RESTRICT) bor — avval o'chiramiz
      await this.prisma.otpCode.deleteMany({ where: { phone: user.phone } });
      // Bu odam biror guruhga kurator bo'lsa — kuratorlikni bo'shatamiz
      await this.prisma.group.updateMany({ where: { curatorId: id }, data: { curatorId: null } });
      return await this.prisma.user.delete({ where: { id } });
    } catch (e: any) {
      if (e instanceof NotFoundException) throw e;
      // To'liq tafsilotni Render logiga yozamiz
      // eslint-disable-next-line no-console
      console.error('[users.remove] xato:', e);
      const detail = [e?.code, e?.meta?.field_name || e?.meta?.constraint, e?.message]
        .filter(Boolean)
        .join(' | ') || 'nomalum';
      throw new BadRequestException(`O'chirib bo'lmadi: ${detail}`);
    }
  }

  async updateGroup(id: number, groupId: number | null) {
    if (groupId !== null) {
      const group = await this.prisma.group.findUnique({ where: { id: groupId } });
      if (!group) throw new NotFoundException('Guruh topilmadi');
    }
    return this.prisma.user.update({
      where: { id },
      data: { groupId },
      select: {
        id: true,
        phone: true,
        name: true,
        role: true,
        groupId: true,
        group: { select: { id: true, name: true } },
      },
    });
  }
}
