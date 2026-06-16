import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestDto, UpdateTestDto, TestFilterDto, UpsertTestQuestionDto } from './dto/tests.dto';
import { Role } from '@prisma/client';

@Injectable()
export class TestsService {
  constructor(private prisma: PrismaService) {}

  // ─── Barcha testlarni olish (foydalanuvchi uchun) ───────────────────────────
  async findAll(filter: TestFilterDto, userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const tests = await this.prisma.test.findMany({
      where: {
        isActive: true,
        ...(filter.type && { type: filter.type }),
        ...(filter.year && { year: filter.year }),
      },
      select: {
        id: true,
        type: true,
        title: true,
        year: true,
        variantNo: true,
        price: true,
        duration: true,
        totalQ: true,
        authorName: true,
        collectionName: true,
        topics: true,
        coverImage: true,
        pdfUrl: true,
        telegramId: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [{ year: 'desc' }, { variantNo: 'asc' }],
    });

    // Har bir test uchun foydalanuvchi sotib olganmi tekshiramiz
    const testIds = tests.map((t) => t.id);
    const payments = await this.prisma.payment.findMany({
      where: {
        userId,
        testId: { in: testIds },
        status: 'PAID',
      },
      select: { testId: true },
    });

    const paidTestIds = new Set(payments.map((p) => p.testId));

    return tests.map((test) => ({
      ...test,
      // isPaid: haqiqiy to'lov holati (admin/student farqi yo'q)
      isPaid: test.price === 0 || paidTestIds.has(test.id),
    }));
  }

  // ─── To'lov sahifasi uchun (tekshiruvsiz) ───────────────────────────────────
  async findInfo(id: number) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      select: { id: true, title: true, price: true, duration: true, totalQ: true, type: true, authorName: true, year: true },
    });
    if (!test) throw new NotFoundException('Test topilmadi');
    return test;
  }

  // ─── Bitta testni olish ──────────────────────────────────────────────────────
  async findOne(id: number, userId: number) {
    const [test, user] = await Promise.all([
      this.prisma.test.findUnique({
        where: { id },
        include: { _count: { select: { questions: true, attempts: true } } },
      }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);

    if (!test) throw new NotFoundException('Test topilmadi');

    const isAdmin = user?.role && user.role !== 'STUDENT';

    // To'lov tekshiruvi — faqat studentlar uchun
    if (test.price > 0 && !isAdmin) {
      const payment = await this.prisma.payment.findFirst({
        where: { userId, testId: id, status: 'PAID' },
      });
      if (!payment) {
        throw new ForbiddenException("Bu test to'liq. To'lov qiling.");
      }
    }

    return test;
  }

  // ─── Test yaratish (faqat admin/o'qituvchi) ──────────────────────────────────
  async create(dto: CreateTestDto) {
    return this.prisma.test.create({ data: dto });
  }

  // ─── Testni yangilash ────────────────────────────────────────────────────────
  async update(id: number, dto: UpdateTestDto) {
    const current = await this.ensureExists(id);

    // telegramId ("ID") o'zgarsa — videolar ham shu ID bilan birga ko'chadi.
    // Agar yangi ID boshqa testda bo'lsa, ikkala testning ID va videolari almashtiriladi (swap).
    const changingTgId =
      dto.telegramId !== undefined && dto.telegramId !== current.telegramId;

    if (changingTgId) {
      const newTgId = dto.telegramId ?? null;
      const other =
        newTgId === null
          ? null
          : await this.prisma.test.findUnique({ where: { telegramId: newTgId } });

      // Boshqa test shu yangi ID ga ega bo'lsa — to'liq swap (ID + videolar)
      if (other && other.id !== id) {
        const TEMP = -1_000_000 - id; // vaqtinchalik to'qnashmaydigan testId
        await this.prisma.$transaction(async (tx) => {
          // 1. unique cheklov uchun ikkala testdan ham telegramId ni bo'shatamiz
          await tx.test.update({ where: { id: other.id }, data: { telegramId: null } });
          await tx.test.update({ where: { id }, data: { telegramId: null } });

          // 2. videolarni almashtiramiz (vaqtinchalik TEMP orqali)
          await tx.videoSolution.updateMany({ where: { testId: other.id }, data: { testId: TEMP } });
          await tx.videoSolution.updateMany({ where: { testId: id }, data: { testId: other.id } });
          await tx.videoSolution.updateMany({ where: { testId: TEMP }, data: { testId: id } });

          // 3. telegramId larni almashtiramiz
          await tx.test.update({ where: { id }, data: { telegramId: newTgId } });
          await tx.test.update({ where: { id: other.id }, data: { telegramId: current.telegramId } });
        });

        // qolgan maydonlarni (telegramId dan tashqari) yangilaymiz
        const { telegramId, ...rest } = dto;
        return this.prisma.test.update({ where: { id }, data: rest });
      }
    }

    return this.prisma.test.update({ where: { id }, data: dto });
  }

  // ─── Testni o'chirish ────────────────────────────────────────────────────────
  async remove(id: number) {
    await this.ensureExists(id);
    // Bog'liq yozuvlarni tartib bilan o'chiramiz
    await this.prisma.$transaction(async (tx) => {
      // 1. Attempt answers
      const attempts = await tx.attempt.findMany({ where: { testId: id }, select: { id: true } });
      const attemptIds = attempts.map((a: any) => a.id);
      if (attemptIds.length > 0) {
        await tx.answer.deleteMany({ where: { attemptId: { in: attemptIds } } });
      }
      // 2. Attempts
      await tx.attempt.deleteMany({ where: { testId: id } });
      // 3. Payments
      await tx.payment.deleteMany({ where: { testId: id } });
      // 4. Video solutions
      await tx.videoSolution.deleteMany({ where: { testId: id } });
      // 5. Test questions
      await tx.testQuestion.deleteMany({ where: { testId: id } });
      // 6. Deadlines
      await tx.deadline.deleteMany({ where: { testId: id } });
      // 7. Test groups
      await tx.testGroup.deleteMany({ where: { testId: id } });
      // 8. Test itself
      await tx.test.delete({ where: { id } });
    });
    return { success: true };
  }

  // ─── Testni guruhga ochish (boshlanish + tugash oynasi bilan) ───────────────
  async openForGroup(testId: number, groupId: number, startsAt?: Date, endsAt?: Date) {
    await this.ensureExists(testId);

    // Guruhga biriktirish + oynani belgilash.
    // Yangi dedlayn belgilanganda reyting qaytadan yuborilishi uchun rankingSentAt=null.
    await this.prisma.testGroup.upsert({
      where: { testId_groupId: { testId, groupId } },
      create: { testId, groupId, startsAt: startsAt ?? null, endsAt: endsAt ?? null },
      update: { startsAt: startsAt ?? null, endsAt: endsAt ?? null, rankingSentAt: null },
    });

    return { success: true, message: 'Test guruhga ochildi' };
  }

  // ─── Testni guruh uchun QAYTA ochish ────────────────────────────────────────
  // Yangi oyna boshlanadi (openedAt=hozir) — avval ishlaganlar ham qaytadan ishlay oladi.
  async reopenForGroup(testId: number, groupId: number, endsAt?: Date) {
    await this.ensureExists(testId);
    const now = new Date();
    await this.prisma.testGroup.upsert({
      where: { testId_groupId: { testId, groupId } },
      create: { testId, groupId, openedAt: now, startsAt: null, endsAt: endsAt ?? null },
      update: { openedAt: now, startsAt: null, endsAt: endsAt ?? null, rankingSentAt: null },
    });
    return { success: true, message: 'Test qayta ochildi' };
  }

  // ─── Testni guruhdan yopish ──────────────────────────────────────────────────
  // O'chirmaymiz — dedlaynni hozirgi vaqtga qo'yamiz (yopilgan ko'rinadi, qayta ochish mumkin)
  async closeForGroup(testId: number, groupId: number) {
    const tg = await this.prisma.testGroup.findUnique({
      where: { testId_groupId: { testId, groupId } },
    });
    if (tg) {
      await this.prisma.testGroup.update({
        where: { testId_groupId: { testId, groupId } },
        data: { endsAt: new Date() },
      });
    }
    return { success: true, message: 'Test guruhdan yopildi' };
  }

  // ─── Guruh testlari (student uchun): qulf holati bilan ───────────────────────
  async getGroupTests(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.groupId) return { groupId: null, tests: [] };

    const testGroups = await this.prisma.testGroup.findMany({
      where: { groupId: user.groupId, test: { type: 'TOPIC', isActive: true } },
      include: {
        test: {
          select: { id: true, title: true, totalQ: true, duration: true, type: true },
        },
      },
      orderBy: { openedAt: 'asc' },
    });

    const testIds = testGroups.map((tg) => tg.testId);
    const attempts = await this.prisma.attempt.findMany({
      where: { userId, testId: { in: testIds } },
      select: { id: true, testId: true, status: true, score: true, startedAt: true },
    });

    // Har bir test uchun joriy oyna boshlanishi (qayta ochilganda yangilanadi)
    const windowStart = new Map<number, Date>();
    for (const tg of testGroups) {
      windowStart.set(tg.testId, tg.startsAt ?? tg.openedAt);
    }
    // Faqat joriy oyna ichidagi (yoki davom etayotgan) urinishni hisobga olamiz
    const attemptMap = new Map<number, (typeof attempts)[number]>();
    for (const a of attempts) {
      const ws = windowStart.get(a.testId);
      if (a.status !== 'IN_PROGRESS' && ws && a.startedAt < ws) continue; // eski oynadagi urinish — e'tiborsiz
      const prev = attemptMap.get(a.testId);
      if (!prev || a.startedAt > prev.startedAt) attemptMap.set(a.testId, a);
    }

    const now = new Date();
    return {
      groupId: user.groupId,
      tests: testGroups.map((tg) => {
        const attempt = attemptMap.get(tg.testId) || null;
        let status: 'LOCKED' | 'OPEN' | 'CLOSED' | 'DONE' = 'OPEN';
        if (tg.startsAt && now < tg.startsAt) status = 'LOCKED';
        else if (tg.endsAt && now > tg.endsAt) status = 'CLOSED';
        if (attempt && attempt.status !== 'IN_PROGRESS') status = 'DONE';

        return {
          testId: tg.testId,
          title: tg.test.title,
          totalQ: tg.test.totalQ,
          duration: tg.test.duration || 90,
          startsAt: tg.startsAt,
          endsAt: tg.endsAt,
          status,
          attemptId: attempt?.id ?? null,
          attemptStatus: attempt?.status ?? null,
          score: attempt?.score ?? null,
        };
      }),
    };
  }

  // ─── Guruh testlari (kurator/admin uchun): biriktirilgan guruhlar ────────────
  async getTestGroupWindows(testId: number) {
    await this.ensureExists(testId);
    return this.prisma.testGroup.findMany({
      where: { testId },
      include: { group: { select: { id: true, name: true, telegramChatId: true } } },
      orderBy: { openedAt: 'asc' },
    });
  }

  // ─── Statistika (admin dashboard) ───────────────────────────────────────────
  async getStats() {
    const [totalTests, totalUsers, totalAttempts, byType] = await Promise.all([
      this.prisma.test.count(),
      this.prisma.user.count(),
      this.prisma.attempt.count({ where: { status: 'COMPLETED' } }),
      this.prisma.test.groupBy({
        by: ['type'],
        _count: { id: true },
      }),
    ]);

    return {
      totalTests,
      totalUsers,
      totalAttempts,
      byType: byType.map((t) => ({ type: t.type, count: t._count.id })),
    };
  }

  // ─── Yillar ro'yxati (DTM uchun) ────────────────────────────────────────────
  async getDtmYears() {
    const years = await this.prisma.test.findMany({
      where: { type: 'DTM_VARIANT' },
      select: { year: true },
      distinct: ['year'],
      orderBy: { year: 'desc' },
    });
    return years.map((y) => y.year);
  }

  // ─── Test savollari (DTM/Milliy Sert/Atestatsiya uchun) ─────────────────────
  async getTestQuestions(testId: number, hideAnswers = true) {
    await this.ensureExists(testId);
    const rows = await this.prisma.testQuestion.findMany({
      where: { testId },
      orderBy: { orderNo: 'asc' },
    });
    if (hideAnswers) {
      // Student uchun: to'g'ri javobni yashiramiz
      return rows.map(({ correctAnswer, ...rest }) => rest);
    }
    return rows;
  }

  async upsertTestQuestion(testId: number, dto: UpsertTestQuestionDto) {
    await this.ensureExists(testId);
    return this.prisma.testQuestion.upsert({
      where: { testId_orderNo: { testId, orderNo: dto.orderNo } },
      create: {
        testId,
        orderNo: dto.orderNo,
        imageUrl: dto.imageUrl,
        questionText: dto.questionText,
        correctAnswer: dto.correctAnswer,
        scorePoint: dto.scorePoint,
      },
      update: {
        imageUrl: dto.imageUrl,
        questionText: dto.questionText,
        correctAnswer: dto.correctAnswer,
        scorePoint: dto.scorePoint,
      },
    });
  }

  async bulkUpsertTestQuestions(testId: number, items: UpsertTestQuestionDto[]) {
    await this.ensureExists(testId);
    const ops = items.map((dto) =>
      this.prisma.testQuestion.upsert({
        where: { testId_orderNo: { testId, orderNo: dto.orderNo } },
        create: { testId, orderNo: dto.orderNo, imageUrl: dto.imageUrl, questionText: dto.questionText, correctAnswer: dto.correctAnswer, scorePoint: dto.scorePoint },
        update: { imageUrl: dto.imageUrl, questionText: dto.questionText, correctAnswer: dto.correctAnswer, scorePoint: dto.scorePoint },
      }),
    );
    return this.prisma.$transaction(ops);
  }

  async deleteTestQuestion(testId: number, orderNo: number) {
    return this.prisma.testQuestion.delete({
      where: { testId_orderNo: { testId, orderNo } },
    });
  }

  // ─── Kolleksiya muqovasini yangilash (barcha variantlarga) ─────────────────
  async updateCollectionCover(authorName: string, collectionName: string, coverImage: string) {
    await this.prisma.test.updateMany({
      where: { authorName, collectionName },
      data: { coverImage },
    });
    return { success: true };
  }

  private async ensureExists(id: number) {
    const test = await this.prisma.test.findUnique({ where: { id } });
    if (!test) throw new NotFoundException('Test topilmadi');
    return test;
  }
}
