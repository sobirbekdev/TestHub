import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  // ─── Umumiy reyting ───────────────────────────────────────────────────────────
  async getGlobal(limit = 50) {
    const results = await this.prisma.attempt.groupBy({
      by: ['userId'],
      where: { status: 'COMPLETED' },
      _avg: { score: true },
      _count: { id: true },
      orderBy: { _avg: { score: 'desc' } },
      take: limit,
    });

    return this.enrichWithUsers(results);
  }

  // ─── Guruh reytingi ───────────────────────────────────────────────────────────
  async getByGroup(groupId: number) {
    const users = await this.prisma.user.findMany({
      where: { groupId },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);

    const results = await this.prisma.attempt.groupBy({
      by: ['userId'],
      where: { status: 'COMPLETED', userId: { in: userIds } },
      _avg: { score: true },
      _count: { id: true },
      orderBy: { _avg: { score: 'desc' } },
    });

    return this.enrichWithUsers(results);
  }

  // ─── Kunlik reyting ───────────────────────────────────────────────────────────
  async getDaily() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = await this.prisma.attempt.groupBy({
      by: ['userId'],
      where: {
        status: 'COMPLETED',
        finishedAt: { gte: today },
      },
      _avg: { score: true },
      _count: { id: true },
      orderBy: { _avg: { score: 'desc' } },
      take: 50,
    });

    return this.enrichWithUsers(results);
  }

  // ─── Foydalanuvchi statistikasi ───────────────────────────────────────────────
  async getUserStats(userId: number) {
    const attempts = await this.prisma.attempt.findMany({
      where: { userId, status: 'COMPLETED' },
      include: { test: { select: { type: true } } },
      orderBy: { finishedAt: 'desc' },
    });

    // Haftalik ma'lumot (oxirgi 7 kun)
    const weekly = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayAttempts = attempts.filter((a) => {
        const d = new Date(a.finishedAt!);
        return d >= date && d < nextDate;
      });

      return {
        date: date.toISOString().split('T')[0],
        count: dayAttempts.length,
        avgScore:
          dayAttempts.length > 0
            ? Math.round(
                dayAttempts.reduce((s, a) => s + (a.score || 0), 0) /
                  dayAttempts.length,
              )
            : 0,
      };
    }).reverse();

    // Test turi bo'yicha
    const byType: Record<string, { count: number; avgScore: number }> = {};
    for (const a of attempts) {
      const t = a.test.type;
      if (!byType[t]) byType[t] = { count: 0, avgScore: 0 };
      byType[t].count++;
      byType[t].avgScore += a.score || 0;
    }
    Object.keys(byType).forEach((k) => {
      byType[k].avgScore = Math.round(byType[k].avgScore / byType[k].count);
    });

    const avgScore =
      attempts.length > 0
        ? Math.round(
            attempts.reduce((s, a) => s + (a.score || 0), 0) / attempts.length,
          )
        : 0;

    return {
      totalAttempts: attempts.length,
      avgScore,
      weekly,
      byType,
    };
  }

  private async enrichWithUsers(
    results: { userId: number; _avg: { score: number | null }; _count: { id: number } }[],
  ) {
    const userIds = results.map((r) => r.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, phone: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return results.map((r, idx) => ({
      rank: idx + 1,
      userId: r.userId,
      name: userMap.get(r.userId)?.name || 'Nomsiz',
      phone: userMap.get(r.userId)?.phone || '',
      avgScore: Math.round((r._avg.score || 0) * 10) / 10,
      attempts: r._count.id,
    }));
  }
}
