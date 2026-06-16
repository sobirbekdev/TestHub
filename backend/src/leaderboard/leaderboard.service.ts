import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface RankRow {
  userId: number;
  avgScore: number;
  attempts: number;
  totalMs: number;
}

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  // Ko'ruvchining guruhi bo'yicha filtr. Guruhi bo'lsa — faqat o'sha guruh,
  // bo'lmasa (guruhsiz) — barcha foydalanuvchilar (umumiy).
  private async viewerScope(viewerId?: number): Promise<Prisma.AttemptWhereInput> {
    if (!viewerId) return {};
    const viewer = await this.prisma.user.findUnique({
      where: { id: viewerId },
      select: { groupId: true },
    });
    return viewer?.groupId ? { user: { groupId: viewer.groupId } } : {};
  }

  // ─── Umumiy reyting — ko'ruvchining o'z guruhi ichida ───────────────────────
  async getGlobal(viewerId?: number, limit = 100) {
    const scope = await this.viewerScope(viewerId);
    return this.aggregateRanking({ status: 'COMPLETED', ...scope }, limit);
  }

  // ─── Guruh reytingi ───────────────────────────────────────────────────────
  async getByGroup(groupId: number) {
    const users = await this.prisma.user.findMany({
      where: { groupId },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    return this.aggregateRanking({
      status: 'COMPLETED',
      userId: { in: userIds },
    });
  }

  // ─── Kunlik reyting — ko'ruvchining o'z guruhi ichida ───────────────────────
  async getDaily(viewerId?: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scope = await this.viewerScope(viewerId);
    return this.aggregateRanking(
      { status: 'COMPLETED', finishedAt: { gte: today }, ...scope },
      50,
    );
  }

  // ─── Yagona test bo'yicha guruh leaderboardi ────────────────────────────────
  // (test natijasidan keyin "guruhda kim eng ko'p ishladi" uchun)
  async getTestLeaderboard(testId: number, groupId?: number) {
    const attempts = await this.prisma.attempt.findMany({
      where: {
        testId,
        status: 'COMPLETED',
        ...(groupId ? { user: { groupId } } : {}),
      },
      select: {
        userId: true,
        score: true,
        totalScore: true,
        startedAt: true,
        finishedAt: true,
        user: { select: { name: true, phone: true, group: { select: { name: true } } } },
      },
    });

    // Har bir user uchun eng yaxshi urinish (yuqori ball, kam vaqt)
    const best = new Map<number, (typeof attempts)[0] & { ms: number }>();
    for (const a of attempts) {
      const ms = a.finishedAt
        ? new Date(a.finishedAt).getTime() - new Date(a.startedAt).getTime()
        : Number.MAX_SAFE_INTEGER;
      const prev = best.get(a.userId);
      if (
        !prev ||
        (a.score || 0) > (prev.score || 0) ||
        ((a.score || 0) === (prev.score || 0) && ms < prev.ms)
      ) {
        best.set(a.userId, { ...a, ms });
      }
    }

    const rows = [...best.values()].sort(
      (a, b) => (b.score || 0) - (a.score || 0) || a.ms - b.ms,
    );

    return rows.map((r, idx) => ({
      rank: idx + 1,
      userId: r.userId,
      name: r.user.name || 'Nomsiz',
      phone: r.user.phone,
      groupName: r.user.group?.name || null,
      score: Math.round((r.score || 0) * 10) / 10,
      totalScore: r.totalScore != null ? Math.round(r.totalScore * 10) / 10 : null,
      timeSec: r.ms === Number.MAX_SAFE_INTEGER ? null : Math.round(r.ms / 1000),
    }));
  }

  // ─── Foydalanuvchi statistikasi ─────────────────────────────────────────────
  async getUserStats(userId: number) {
    const attempts = await this.prisma.attempt.findMany({
      where: { userId, status: 'COMPLETED' },
      include: { test: { select: { type: true } } },
      orderBy: { finishedAt: 'desc' },
    });

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

    return { totalAttempts: attempts.length, avgScore, weekly, byType };
  }

  // ─── Umumiy agregator (o'rtacha ball desc, teng bo'lsa kam vaqt yuqori) ──────
  private async aggregateRanking(
    where: Prisma.AttemptWhereInput,
    limit?: number,
  ) {
    const attempts = await this.prisma.attempt.findMany({
      where,
      select: { userId: true, score: true, startedAt: true, finishedAt: true },
    });

    const map = new Map<number, { sumScore: number; count: number; sumMs: number }>();
    for (const a of attempts) {
      const e = map.get(a.userId) || { sumScore: 0, count: 0, sumMs: 0 };
      e.sumScore += a.score || 0;
      e.count++;
      if (a.finishedAt) {
        e.sumMs += new Date(a.finishedAt).getTime() - new Date(a.startedAt).getTime();
      }
      map.set(a.userId, e);
    }

    const rows: RankRow[] = [...map.entries()].map(([userId, e]) => ({
      userId,
      avgScore: e.sumScore / e.count,
      attempts: e.count,
      totalMs: e.sumMs,
    }));

    // O'rtacha ball bo'yicha kamayish, teng bo'lsa kam vaqt sarflagani yuqori
    rows.sort((a, b) => b.avgScore - a.avgScore || a.totalMs - b.totalMs);

    return this.enrichWithUsers(limit ? rows.slice(0, limit) : rows);
  }

  private async enrichWithUsers(rows: RankRow[]) {
    const userIds = rows.map((r) => r.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, phone: true, group: { select: { name: true } } },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return rows.map((r, idx) => ({
      rank: idx + 1,
      userId: r.userId,
      // Ism bo'sh bo'lsa '' qaytaramiz — frontend telefon oxirini ko'rsatadi
      name: userMap.get(r.userId)?.name?.trim() || '',
      phone: userMap.get(r.userId)?.phone || '',
      groupName: userMap.get(r.userId)?.group?.name || null,
      avgScore: Math.round(r.avgScore * 10) / 10,
      attempts: r.attempts,
      totalTimeSec: Math.round(r.totalMs / 1000),
    }));
  }
}
