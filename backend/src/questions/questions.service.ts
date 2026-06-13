import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateQuestionDto,
  UpdateQuestionDto,
  AddToTestDto,
  QuestionFilterDto,
} from './dto/questions.dto';

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  // ─── Barcha savollar (admin uchun, filter bilan) ─────────────────────────────
  async findAll(filter: QuestionFilterDto) {
    return this.prisma.question.findMany({
      where: {
        ...(filter.difficulty && { difficulty: filter.difficulty }),
        ...(filter.qType && { qType: filter.qType }),
        ...(filter.testId && {
          testLinks: { some: { testId: filter.testId } },
        }),
      },
      include: {
        options: { orderBy: { label: 'asc' } },
        _count: { select: { testLinks: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  // ─── Test savollari (foydalanuvchi test ishlayotganda) ───────────────────────
  async findByTest(testId: number) {
    const testQuestions = await this.prisma.testQuestion.findMany({
      where: { testId },
      include: {
        question: {
          include: {
            options: {
              orderBy: { label: 'asc' },
              select: {
                id: true,
                label: true,
                text: true,
                // isCorrect ni YUBORMAYMIZ (foydalanuvchiga sir)
              },
            },
          },
        },
      },
      orderBy: { orderNo: 'asc' },
    });

    return testQuestions.map((tq) => ({
      orderNo: tq.orderNo,
      ...tq.question,
      // difficulty ni ham yashiramiz (foydalanuvchiga ko'rsatilmaydi)
      difficulty: undefined,
    }));
  }

  // ─── Bitta savol (to'g'ri javoblar bilan — admin uchun) ──────────────────────
  async findOne(id: number) {
    const q = await this.prisma.question.findUnique({
      where: { id },
      include: { options: { orderBy: { label: 'asc' } } },
    });
    if (!q) throw new NotFoundException('Savol topilmadi');
    return q;
  }

  // ─── Savol yaratish ──────────────────────────────────────────────────────────
  async create(dto: CreateQuestionDto) {
    const { options, ...questionData } = dto;

    return this.prisma.question.create({
      data: {
        ...questionData,
        ...(options && {
          options: { create: options },
        }),
      },
      include: { options: true },
    });
  }

  // ─── Ko'p savolni birdan yaratish (import uchun) ─────────────────────────────
  async createBulk(questions: CreateQuestionDto[]) {
    const created = [];
    for (const dto of questions) {
      const q = await this.create(dto);
      created.push(q);
    }
    return { count: created.length, questions: created };
  }

  // ─── Savolni yangilash ───────────────────────────────────────────────────────
  async update(id: number, dto: UpdateQuestionDto) {
    await this.ensureExists(id);
    return this.prisma.question.update({
      where: { id },
      data: dto,
      include: { options: true },
    });
  }

  // ─── Savolni o'chirish ───────────────────────────────────────────────────────
  async remove(id: number) {
    await this.ensureExists(id);
    return this.prisma.question.delete({ where: { id } });
  }

  // ─── Testga savol qo'shish ───────────────────────────────────────────────────
  async addToTest(questionId: number, dto: AddToTestDto) {
    await this.ensureExists(questionId);
    return this.prisma.testQuestion.create({
      data: {
        testId: dto.testId,
        questionId,
        orderNo: dto.orderNo,
      },
    });
  }

  // ─── Testdan savolni olib tashlash ───────────────────────────────────────────
  async removeFromTest(questionId: number, testId: number) {
    return this.prisma.testQuestion.deleteMany({
      where: { questionId, testId },
    });
  }

  // ─── Savol bazasi statistikasi ───────────────────────────────────────────────
  async getStats() {
    const [byDifficulty, byType, total] = await Promise.all([
      this.prisma.question.groupBy({
        by: ['difficulty'],
        _count: { id: true },
      }),
      this.prisma.question.groupBy({
        by: ['qType'],
        _count: { id: true },
      }),
      this.prisma.question.count(),
    ]);

    return {
      total,
      byDifficulty: byDifficulty.map((d) => ({
        difficulty: d.difficulty,
        count: d._count.id,
      })),
      byType: byType.map((t) => ({
        type: t.qType,
        count: t._count.id,
      })),
    };
  }

  // ─── Option yangilash ────────────────────────────────────────────────────────
  async updateOption(
    optionId: number,
    data: { text?: string; isCorrect?: boolean },
  ) {
    return this.prisma.option.update({ where: { id: optionId }, data });
  }

  // ─── Option o'chirish ────────────────────────────────────────────────────────
  async removeOption(optionId: number) {
    return this.prisma.option.delete({ where: { id: optionId } });
  }

  // ─── Option qo'shish ─────────────────────────────────────────────────────────
  async addOption(
    questionId: number,
    data: { label: string; text: string; isCorrect: boolean },
  ) {
    await this.ensureExists(questionId);
    return this.prisma.option.create({ data: { ...data, questionId } });
  }

  private async ensureExists(id: number) {
    const q = await this.prisma.question.findUnique({ where: { id } });
    if (!q) throw new NotFoundException('Savol topilmadi');
    return q;
  }
}
