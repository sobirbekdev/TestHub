import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  // CURATOR faqat o'ziga biriktirilgan guruhlarni ko'radi; admin/teacher hammasini
  async findAll(user?: { id: number; role: string }) {
    return this.prisma.group.findMany({
      where: user && user.role === 'CURATOR' ? { curatorId: user.id } : undefined,
      include: {
        _count: { select: { users: true } },
        curator: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, name: true, phone: true, role: true } },
        testGroups: {
          include: { test: { select: { id: true, title: true, type: true } } },
        },
      },
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    return group;
  }

  async create(name: string) {
    return this.prisma.group.create({ data: { name } });
  }

  async update(id: number, name: string) {
    return this.prisma.group.update({ where: { id }, data: { name } });
  }

  async setCurator(id: number, curatorId: number | null) {
    return this.prisma.group.update({ where: { id }, data: { curatorId } });
  }

  async remove(id: number) {
    return this.prisma.group.delete({ where: { id } });
  }

  async addUser(groupId: number, userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { groupId },
    });
  }

  async removeUser(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { groupId: null },
    });
  }
}
