import { Injectable, NotFoundException } from '@nestjs/common';
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

  async updateName(id: number, name: string) {
    return this.prisma.user.update({
      where: { id },
      data: { name },
      select: { id: true, phone: true, name: true, role: true, groupId: true },
    });
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
