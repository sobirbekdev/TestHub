import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { StartAttemptDto, FinishAttemptDto } from './dto/attempts.dto';

@Injectable()
export class AttemptsService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  // ─── Test boshlash ────────────────────────────────────────────────────────────
  async start(userId: number, dto: StartAttemptDto) {
    const [test, user] = await Promise.all([
      this.prisma.test.findUnique({ where: { id: dto.testId } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);
    if (!test) throw new NotFoundException('Test topilmadi');

    // Admin va SUPER_ADMIN uchun to'lovsiz ruxsat
    const isAdmin = user?.role && user.role !== 'STUDENT';

    if (test.price > 0 && !isAdmin) {
      const payment = await this.prisma.payment.findFirst({
        where: { userId, testId: dto.testId, status: 'PAID' },
      });
      if (!payment) throw new ForbiddenException("Avval to'lov qiling");
    }

    // Guruh (TOPIC) testi — oyna + bir martalik tekshiruvi (adminlar uchun ham emas)
    if (test.type === 'TOPIC' && user?.groupId && !isAdmin) {
      const tg = await this.prisma.testGroup.findUnique({
        where: { testId_groupId: { testId: dto.testId, groupId: user.groupId } },
      });
      if (tg) {
        const now = new Date();
        if (tg.startsAt && now < tg.startsAt) {
          throw new ForbiddenException('Test hali ochilmagan');
        }
        if (tg.endsAt && now > tg.endsAt) {
          throw new ForbiddenException('Test vaqti tugagan');
        }
        // Bu oynada allaqachon ishlagan bo'lsa — qayta ishlash mumkin emas
        const done = await this.prisma.attempt.findFirst({
          where: {
            userId,
            testId: dto.testId,
            status: { not: 'IN_PROGRESS' },
            ...(tg.startsAt && { startedAt: { gte: tg.startsAt } }),
          },
        });
        if (done) throw new ForbiddenException('Bu testni allaqachon ishlagansiz');
      }
    }

    const existing = await this.prisma.attempt.findFirst({
      where: { userId, testId: dto.testId, status: 'IN_PROGRESS' },
    });
    if (existing) return existing;

    return this.prisma.attempt.create({
      data: { userId, testId: dto.testId },
    });
  }

  // ─── Testni yakunlash ─────────────────────────────────────────────────────────
  async finish(userId: number, attemptId: number, dto: FinishAttemptDto) {
    const attempt = await this.prisma.attempt.findFirst({
      where: { id: attemptId, userId },
      include: { test: true },
    });
    if (!attempt) throw new NotFoundException('Urinish topilmadi');

    // Allaqachon tugallangan bo'lsa — natijani qaytaramiz (takroriy so'rov)
    if (attempt.status !== 'IN_PROGRESS') {
      return attempt;
    }

    // Vaqt chegarasi (taymer): test.duration daqiqa (default 90)
    const limitMin = attempt.test.duration || 90;
    const elapsedMs = Date.now() - new Date(attempt.startedAt).getTime();
    (attempt as any).__timedOut = elapsedMs > limitMin * 60 * 1000;

    const testType = attempt.test.type;
    const isImageBased =
      testType === 'DTM_VARIANT' ||
      testType === 'NATIONAL_CERT' ||
      testType === 'ATTESTATION';

    if (isImageBased) {
      return this.finishImageBased(attempt, dto);
    } else {
      return this.finishQuestionBased(attempt, dto);
    }
  }

  // ─── Rasm asosidagi test (DTM, Milliy Sert, Atestatsiya) ─────────────────────
  private async finishImageBased(attempt: any, dto: FinishAttemptDto) {
    const testId = attempt.testId;
    const attemptId = attempt.id;

    // TestQuestion answer keys
    const testQuestions = await this.prisma.testQuestion.findMany({
      where: { testId },
      orderBy: { orderNo: 'asc' },
    });
    const tqMap = new Map(testQuestions.map((tq) => [tq.orderNo, tq]));

    let correct = 0;
    let totalScored = 0;
    let totalPossible = 0;
    let manualPending = 0;
    let aiPending = 0;

    for (const tq of testQuestions) {
      totalPossible += tq.scorePoint || 1;
    }

    // Mavjud javoblarni bir marta o'qiymiz (har biri uchun alohida so'rov o'rniga)
    const existing = await this.prisma.answer.findMany({
      where: { attemptId },
      select: { orderNo: true },
    });
    const existingOrderNos = new Set(existing.map((e) => e.orderNo));

    const toCreate: any[] = [];
    const updatePromises: Promise<any>[] = [];

    for (const ans of dto.answers) {
      const orderNo = ans.orderNo;
      if (!orderNo) continue;

      const tq = tqMap.get(orderNo);
      const scorePoint = tq?.scorePoint || 1;

      // Milliy Sert 36-40 (open text — admin qo'lda tekshiradi)
      const isOpen = orderNo >= 36 && orderNo <= 40 && attempt.test.type === 'NATIONAL_CERT';
      const isAiCheck = orderNo >= 41 && orderNo <= 43 && attempt.test.type === 'NATIONAL_CERT';

      let isCorrect: boolean | null = null;
      let aiStatus: string | null = null;

      if (isAiCheck) {
        aiStatus = 'PENDING';
        aiPending++;
      } else if (isOpen) {
        if (tq?.correctAnswer && ans.openText) {
          isCorrect = this.normalizeText(ans.openText) === this.normalizeText(tq.correctAnswer);
          if (isCorrect) {
            correct++;
            totalScored += scorePoint;
          }
        } else if (ans.openText) {
          manualPending++;
        }
      } else if (tq?.correctAnswer) {
        const selected = (ans.selectedOpts || [])[0];
        isCorrect = selected?.toUpperCase() === tq.correctAnswer.toUpperCase();
        if (isCorrect) {
          correct++;
          totalScored += scorePoint;
        }
      }

      const ansData = {
        selectedOpts: ans.selectedOpts || [],
        openText: ans.openText || null,
        imageUrl: ans.imageUrl || null,
        isCorrect,
        aiStatus: aiStatus as any,
      };

      if (existingOrderNos.has(orderNo)) {
        updatePromises.push(
          this.prisma.answer.updateMany({ where: { attemptId, orderNo }, data: ansData }),
        );
      } else {
        toCreate.push({ attemptId, orderNo, ...ansData });
      }
    }

    // Yangi javoblarni bitta so'rovda, mavjudlarini parallel yangilaymiz
    await Promise.all([
      toCreate.length > 0
        ? this.prisma.answer.createMany({ data: toCreate, skipDuplicates: true })
        : Promise.resolve(),
      ...updatePromises,
    ]);

    const scorePercent = totalPossible > 0 ? (totalScored / totalPossible) * 100 : 0;

    const updated = await this.prisma.attempt.update({
      where: { id: attemptId },
      data: {
        status: attempt.__timedOut ? 'TIMED_OUT' : 'COMPLETED',
        finishedAt: new Date(),
        score: Math.round(scorePercent * 10) / 10,
        totalScore: totalScored,
      },
    });

    // AI savollar bo'lsa — fonda avtomatik tekshiruv
    if (aiPending > 0) {
      this.aiService.checkAttemptAiAnswers(attemptId).catch(() => {});
    }

    return updated;
  }

  // ─── Savol asosidagi test (DTM_RANDOM, TOPIC) ────────────────────────────────
  private async finishQuestionBased(attempt: any, dto: FinishAttemptDto) {
    const attemptId = attempt.id;

    const questionIds = dto.answers
      .map((a) => a.questionId)
      .filter(Boolean) as number[];
    const questions = await this.prisma.question.findMany({
      where: { id: { in: questionIds } },
      include: { options: true },
    });
    const qMap = new Map(questions.map((q) => [q.id, q]));

    let correct = 0;
    let total = 0;
    let aiPending = 0;

    const upsertPromises: Promise<any>[] = [];

    for (const ans of dto.answers) {
      if (!ans.questionId) continue;
      const q = qMap.get(ans.questionId);
      if (!q) continue;

      let isCorrect: boolean | null = null;

      if (q.qType === 'MULTI' || q.qType === 'REACTIONS') {
        isCorrect = null;
        aiPending++;
      } else if (q.qType === 'OPEN') {
        isCorrect = null;
      } else {
        const correctLabels = q.options
          .filter((o) => o.isCorrect)
          .map((o) => o.label)
          .sort();
        const selected = (ans.selectedOpts || []).sort();
        isCorrect = JSON.stringify(correctLabels) === JSON.stringify(selected);
        if (isCorrect) correct++;
        total++;
      }

      upsertPromises.push(
        this.prisma.answer.upsert({
          where: {
            attemptId_questionId: { attemptId, questionId: ans.questionId },
          },
          create: {
            attemptId,
            questionId: ans.questionId,
            selectedOpts: ans.selectedOpts || [],
            openText: ans.openText,
            imageUrl: ans.imageUrl,
            isCorrect,
            aiStatus:
              q.qType === 'MULTI' || q.qType === 'REACTIONS' ? 'PENDING' : null,
          },
          update: {
            selectedOpts: ans.selectedOpts || [],
            openText: ans.openText,
            imageUrl: ans.imageUrl,
            isCorrect,
          },
        }),
      );
    }

    // Barcha javoblarni parallel yozamiz (ketma-ket emas — tezroq)
    await Promise.all(upsertPromises);

    const score = total > 0 ? (correct / total) * 100 : 0;

    return this.prisma.attempt.update({
      where: { id: attemptId },
      data: {
        status: attempt.__timedOut ? 'TIMED_OUT' : 'COMPLETED',
        finishedAt: new Date(),
        score: Math.round(score * 10) / 10,
      },
    });
  }

  // ─── Natijani ko'rish ─────────────────────────────────────────────────────────
  async getResult(userId: number, attemptId: number) {
    const attempt = await this.prisma.attempt.findFirst({
      where: { id: attemptId, userId },
      include: {
        test: { select: { id: true, title: true, type: true, totalQ: true, pdfUrl: true } },
        answers: {
          include: {
            question: {
              include: {
                options: { orderBy: { label: 'asc' } },
                testLinks: { select: { orderNo: true } },
              },
            },
          },
          orderBy: [{ orderNo: 'asc' }, { questionId: 'asc' }],
        },
      },
    });

    if (!attempt) throw new NotFoundException('Natija topilmadi');

    const testType = attempt.test.type;
    const isImageBased =
      testType === 'DTM_VARIANT' ||
      testType === 'NATIONAL_CERT' ||
      testType === 'ATTESTATION';

    // Video yechimlarni olamiz
    const videoSolutions = await this.prisma.videoSolution.findMany({
      where: { testId: attempt.testId },
    });
    const videoMap = new Map(videoSolutions.map((v) => [v.questionNo, v.fileId]));

    if (isImageBased) {
      // TestQuestion image/answer keys
      const testQuestions = await this.prisma.testQuestion.findMany({
        where: { testId: attempt.testId },
        orderBy: { orderNo: 'asc' },
      });
      const tqMap = new Map(testQuestions.map((tq) => [tq.orderNo, tq]));

      const answersWithInfo = attempt.answers.map((ans) => {
        const tq = ans.orderNo ? tqMap.get(ans.orderNo) : null;
        const correctAnswer = tq?.correctAnswer || null;
        return {
          orderNo: ans.orderNo,
          questionId: null,
          text: null,
          imageUrl: tq?.imageUrl || null,
          correctAnswer,
          correctOptions: correctAnswer ? [correctAnswer] : [],
          scorePoint: tq?.scorePoint || null,
          selectedOpts: ans.selectedOpts,
          openText: ans.openText,
          isCorrect: ans.isCorrect,
          aiStatus: ans.aiStatus,
          aiScore: ans.aiScore,
          aiComment: ans.aiComment,
          videoFileId: ans.orderNo ? videoMap.get(ans.orderNo) || null : null,
        };
      });

      return {
        attemptId: attempt.id,
        test: attempt.test,
        score: attempt.score,
        totalScore: attempt.totalScore,
        status: attempt.status,
        startedAt: attempt.startedAt,
        finishedAt: attempt.finishedAt,
        answers: answersWithInfo,
        testQuestions: testQuestions.map((tq) => ({
          orderNo: tq.orderNo,
          imageUrl: tq.imageUrl,
          correctAnswer: tq.correctAnswer,
          scorePoint: tq.scorePoint,
        })),
      };
    } else {
      const answersWithVideo = attempt.answers.map((ans) => {
        const orderNo = ans.question?.testLinks?.[0]?.orderNo;
        return {
          questionId: ans.questionId,
          orderNo,
          text: ans.question?.text,
          qType: ans.question?.qType,
          selectedOpts: ans.selectedOpts,
          openText: ans.openText,
          imageUrl: ans.imageUrl,
          isCorrect: ans.isCorrect,
          aiStatus: ans.aiStatus,
          aiScore: ans.aiScore,
          aiComment: ans.aiComment,
          correctOptions: ans.question?.options
            .filter((o) => o.isCorrect)
            .map((o) => o.label) || [],
          videoFileId: orderNo ? videoMap.get(orderNo) || null : null,
        };
      });

      return {
        attemptId: attempt.id,
        test: attempt.test,
        score: attempt.score,
        totalScore: attempt.totalScore,
        status: attempt.status,
        startedAt: attempt.startedAt,
        finishedAt: attempt.finishedAt,
        answers: answersWithVideo,
      };
    }
  }

  // ─── Foydalanuvchi urinishlari tarixi ────────────────────────────────────────
  async getHistory(userId: number) {
    return this.prisma.attempt.findMany({
      where: { userId, status: 'COMPLETED' },
      include: {
        test: { select: { id: true, title: true, type: true } },
      },
      orderBy: { finishedAt: 'desc' },
      take: 50,
    });
  }

  // ─── Admin: ochiq javobga ball berish ────────────────────────────────────────
  async gradeOpenAnswer(
    adminId: number,
    answerId: number,
    score: number,
    comment?: string,
  ) {
    const answer = await this.prisma.answer.findUnique({
      where: { id: answerId },
      include: { attempt: { include: { test: true } } },
    });
    if (!answer) throw new NotFoundException('Javob topilmadi');

    await this.prisma.answer.update({
      where: { id: answerId },
      data: {
        scorePoint: score,
        isCorrect: score > 0,
        aiComment: comment,
        aiStatus: 'MANUAL',
      },
    });

    // Attempt totalScore ni qayta hisoblash
    const allAnswers = await this.prisma.answer.findMany({
      where: { attemptId: answer.attemptId },
    });
    const totalScore = allAnswers.reduce(
      (sum, a) => sum + (a.scorePoint || (a.isCorrect ? 1 : 0)),
      0,
    );

    return this.prisma.attempt.update({
      where: { id: answer.attemptId },
      data: { totalScore },
    });
  }

  // Open-text javoblarni solishtirish uchun normallashtirish
  private normalizeText(s: string): string {
    return (s || '')
      .toLowerCase()
      .replace(/\s+/g, '')          // barcha bo'sh joylar
      .replace(/[.,;:!?'"`]/g, '')  // tinish belgilar
      .replace(/[₀-₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d))) // pastki indeks → oddiy raqam
      .replace(/[⁰-⁹]/g, (d) => String('⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(d))) // yuqori indeks → oddiy raqam
      .trim();
  }
}
