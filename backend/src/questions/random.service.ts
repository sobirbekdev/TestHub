import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Difficulty, QuestionType } from '@prisma/client';

interface RandomSlot {
  difficulty: Difficulty;
  qType: QuestionType;
  count: number;
}

// DTM Sinov: 30 savol
const DTM_RANDOM_SLOTS: RandomSlot[] = [
  { difficulty: 'HARD', qType: 'IMAGE', count: 1 },
  { difficulty: 'HARD', qType: 'GRAPH', count: 1 },
  { difficulty: 'HARD', qType: 'THEORY', count: 1 },
  { difficulty: 'HARD', qType: 'TEXT', count: 1 },
  { difficulty: 'MEDIUM', qType: 'IMAGE', count: 1 },
  { difficulty: 'MEDIUM', qType: 'GRAPH', count: 1 },
  { difficulty: 'MEDIUM', qType: 'THEORY', count: 1 },
  { difficulty: 'MEDIUM', qType: 'TEXT', count: 10 },
  { difficulty: 'EASY', qType: 'IMAGE', count: 1 },
  { difficulty: 'EASY', qType: 'GRAPH', count: 1 },
  { difficulty: 'EASY', qType: 'THEORY', count: 1 },
  { difficulty: 'EASY', qType: 'TEXT', count: 10 },
];
// Jami: 4+13+13 = 30 ✅

// Atestatsiya: 35 savol
const ATTESTATION_SLOTS: RandomSlot[] = [
  { difficulty: 'HARD', qType: 'IMAGE', count: 1 },
  { difficulty: 'HARD', qType: 'GRAPH', count: 2 },
  { difficulty: 'HARD', qType: 'THEORY', count: 2 },
  { difficulty: 'HARD', qType: 'TEXT', count: 2 },
  { difficulty: 'MEDIUM', qType: 'IMAGE', count: 1 },
  { difficulty: 'MEDIUM', qType: 'GRAPH', count: 1 },
  { difficulty: 'MEDIUM', qType: 'THEORY', count: 1 },
  { difficulty: 'MEDIUM', qType: 'TEXT', count: 15 },
  { difficulty: 'EASY', qType: 'IMAGE', count: 1 },
  { difficulty: 'EASY', qType: 'GRAPH', count: 0 },
  { difficulty: 'EASY', qType: 'THEORY', count: 0 },
  { difficulty: 'EASY', qType: 'TEXT', count: 9 },
];
// Jami: 7+18+10 = 35 ✅

@Injectable()
export class RandomService {
  constructor(private prisma: PrismaService) {}

  async generateDtmRandom(): Promise<number> {
    return this.generateTest('DTM_RANDOM', DTM_RANDOM_SLOTS, 60);
  }

  async generateAttestation(): Promise<number> {
    return this.generateTest('ATTESTATION_RANDOM', ATTESTATION_SLOTS, 120);
  }

  private async generateTest(
    title: string,
    slots: RandomSlot[],
    duration: number,
  ): Promise<number> {
    const selectedIds: number[] = [];

    for (const slot of slots) {
      if (slot.count === 0) continue;

      const questions = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        `SELECT id FROM questions
         WHERE difficulty = $1 AND "qType" = $2
         AND id NOT IN (${selectedIds.length > 0 ? selectedIds.join(',') : '0'})
         ORDER BY RANDOM() LIMIT $3`,
        slot.difficulty,
        slot.qType,
        slot.count,
      );

      if (questions.length < slot.count) {
        // Yetarli savol yo'q bo'lsa, mavjudlarini olamiz
        const fallback = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
          `SELECT id FROM questions
           WHERE difficulty = $1
           AND id NOT IN (${selectedIds.length > 0 ? selectedIds.join(',') : '0'})
           ORDER BY RANDOM() LIMIT $2`,
          slot.difficulty,
          slot.count - questions.length,
        );
        questions.push(...fallback);
      }

      selectedIds.push(...questions.map((q) => q.id));
    }

    if (selectedIds.length === 0) {
      throw new BadRequestException('Savol bazasi bo\'sh');
    }

    // Yangi test yaratamiz
    const test = await this.prisma.test.create({
      data: {
        type: title.includes('DTM') ? 'DTM_RANDOM' : 'ATTESTATION',
        title: `${title} — ${new Date().toLocaleDateString('uz')}`,
        price: 5000,
        duration,
        totalQ: selectedIds.length,
      },
    });

    // Savollarni testga bog'laymiz
    await this.prisma.testQuestion.createMany({
      data: selectedIds.map((qId, idx) => ({
        testId: test.id,
        questionId: qId,
        orderNo: idx + 1,
      })),
    });

    return test.id;
  }
}
