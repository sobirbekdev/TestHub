import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

interface GeminiResult {
  score: number;       // 0-100
  comment: string;
  status: 'CORRECT' | 'PARTIAL' | 'WRONG';
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiUrl =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  private readonly orUrl = 'https://openrouter.ai/api/v1/chat/completions';

  constructor(private prisma: PrismaService) {}

  // OpenRouter (bepul vision) orqali rasm + matn yuborib javob olish
  private async callVision(
    prompt: string,
    imageUrls: string[],
  ): Promise<string> {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY yo\'q');
    const models = (process.env.OPENROUTER_MODEL || 'nex-agi/nex-n2-pro:free')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);

    const content: any[] = [{ type: 'text', text: prompt }];
    for (const url of imageUrls) {
      const mime = url.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const b64 = await this.urlToBase64(url);
      content.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } });
    }

    const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    let lastErr: any;

    // Har bir modelni navbatma-navbat sinaymiz; band (429) bo'lsa tez keyingisiga o'tamiz
    for (const model of models) {
      const body = { model, messages: [{ role: 'user', content }], temperature: 0.2 };
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          // Tezlik uchun har bir so'rovga 20s limit — qotib qolsa keyingi modelga o'tamiz
          const res = await axios.post(this.orUrl, body, { headers, timeout: 20000 });
          const text = res.data?.choices?.[0]?.message?.content?.trim();
          if (text) {
            this.logger.log(`AI model ishladi: ${model}`);
            return text;
          }
          break; // bo'sh javob — keyingi modelga
        } catch (e: any) {
          lastErr = e;
          const st = e.response?.status;
          if (st === 429 && attempt === 0) {
            await new Promise((r) => setTimeout(r, 800));
            continue; // shu modelni bir marta qayta sinaymiz
          }
          break; // boshqa xato yoki ikkinchi urinish — keyingi modelga o'tamiz
        }
      }
      this.logger.warn(`AI model band/xato: ${model}, keyingisiga o'tilyapti`);
    }
    throw lastErr || new Error('Barcha AI modellar band');
  }

  // Bitta javobni tekshirish
  async checkAnswer(
    answerId: number,
    questionText: string,
    imageUrl: string,
    qType: 'MULTI' | 'REACTIONS',
  ): Promise<GeminiResult> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your-gemini-api-key') {
      // Dev rejimda mock natija
      return { score: 75, comment: 'Dev rejim — AI tekshiruvi o\'chirilgan', status: 'PARTIAL' };
    }

    try {
      const prompt = this.buildPrompt(questionText, qType);

      const body = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: await this.urlToBase64(imageUrl),
                },
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
      };

      const res = await axios.post(`${this.apiUrl}?key=${apiKey}`, body);
      const text = res.data.candidates[0].content.parts[0].text;
      return this.parseGeminiResponse(text);
    } catch (err) {
      this.logger.error(`Gemini xatolik: ${err.message}`);
      return { score: 0, comment: 'AI tekshirishda xatolik', status: 'WRONG' };
    }
  }

  // Attempt ichidagi barcha AI savollarni tekshirish
  async checkAttemptAiAnswers(attemptId: number) {
    const answers = await this.prisma.answer.findMany({
      where: { attemptId, aiStatus: 'PENDING', imageUrl: { not: null } },
      include: { question: true },
    });

    // Savol rasmlari uchun TestQuestion'larni bir marta yuklab olamiz
    const attempt = await this.prisma.attempt.findUnique({ where: { id: attemptId } });
    const tqs = attempt
      ? await this.prisma.testQuestion.findMany({ where: { testId: attempt.testId } })
      : [];
    const tqMap = new Map(tqs.map((t) => [t.orderNo, t]));

    // Barcha javoblarni PARALLEL tekshiramiz — tezlik uchun (30s ichida)
    await Promise.all(
      answers.map(async (ans) => {
        try {
          let result: GeminiResult;

          if (ans.orderNo && !ans.questionId) {
            // NATIONAL_CERT 41-43: orderNo asosida TestQuestion dan to'g'ri javobni olamiz
            const tq = tqMap.get(ans.orderNo);
            const scorePoint = tq?.scorePoint || 1;
            result = await this.checkChemistryAnswer(
              tq?.imageUrl || null,        // savol rasmi (shart)
              ans.imageUrl!,               // talaba javobi rasmi
              tq?.correctAnswer || null,   // ixtiyoriy: admin yozgan javob
              scorePoint,
            );
          } else if (ans.question) {
            result = await this.checkAnswer(
              ans.id,
              ans.question.text,
              ans.imageUrl!,
              ans.question.qType as 'MULTI' | 'REACTIONS',
            );
          } else {
            return;
          }

          await this.prisma.answer.update({
            where: { id: ans.id },
            data: {
              aiScore: result.score,
              aiComment: result.comment,
              aiStatus: 'CONFIRMED',
              isCorrect: result.score > 0,
            },
          });
          this.logger.log(`✅ AI answer=${ans.id} orderNo=${ans.orderNo} score=${result.score}`);
        } catch (e) {
          this.logger.error(`Answer ${ans.id} AI xatolik: ${e.message}`);
          await this.prisma.answer.update({
            where: { id: ans.id },
            data: { aiStatus: 'RECHECK' },
          });
        }
      }),
    );

    // Attempt umumiy ballini yangilaymiz
    await this.recalcAttemptScore(attemptId);
  }

  // NATIONAL_CERT 41-43: rasm va to'g'ri javobni solishtirish
  async checkImageAnswer(imageUrl: string, correctAnswer: string, maxScore: number): Promise<GeminiResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-gemini-api-key') {
      return { score: 0, comment: 'AI kaliti yo\'q', status: 'WRONG' };
    }

    try {
      const prompt = `Siz imtihon tekshiruvchisisiz. Talabaning yozma javob rasmi berilgan.

To'g'ri javob: "${correctAnswer}"

Rasmdagi talaba javobini yuqoridagi to'g'ri javob bilan solishtiring.
- Agar javob to'liq to'g'ri bo'lsa: BALL: ${maxScore}
- Agar qisman to'g'ri bo'lsa: BALL: ${Math.round(maxScore / 2)}
- Agar noto'g'ri yoki bo'sh bo'lsa: BALL: 0

Faqat quyidagi formatda javob bering:
BALL: [son]
IZOH: [1 qator izoh]`;

      const body = {
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: await this.urlToBase64(imageUrl) } },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
      };

      const res = await axios.post(`${this.apiUrl}?key=${apiKey}`, body);
      const text = res.data.candidates[0].content.parts[0].text;
      return this.parseGeminiResponse(text);
    } catch (err) {
      this.logger.error(`checkImageAnswer xatolik: ${err.message}`);
      return { score: 0, comment: 'AI tekshirishda xatolik', status: 'WRONG' };
    }
  }

  // NATIONAL_CERT 41-43: savol rasmi + talaba javobi rasmini kimyoviy baholash (qisman ball bilan)
  async checkChemistryAnswer(
    questionImageUrl: string | null,
    answerImageUrl: string,
    correctAnswer: string | null,
    maxScore: number,
  ): Promise<GeminiResult> {
    if (!process.env.OPENROUTER_API_KEY) {
      return { score: 0, comment: 'AI kaliti yo\'q', status: 'WRONG' };
    }

    const half = Math.round(maxScore / 2);
    const prompt = `Siz tajribali kimyo imtihon tekshiruvchisisiz.
${questionImageUrl ? '1-rasm — SAVOL (masala sharti). 2-rasm — TALABA yozgan javob/yechim.' : 'Rasm — talabaning yozma javobi.'}
${correctAnswer ? `\nTo'g'ri javob (ma'lumot uchun): "${correctAnswer}"` : ''}

Vazifa: talaba javobini kimyoviy jihatdan baholang. Reaksiya tenglamalari to'g'ri yozilganmi, koeffitsiyentlar muvozanatlanganmi, mahsulotlar to'g'rimi — shularni tekshiring.

Ball berish (0 dan ${maxScore} gacha, QISMAN ball bering):
- To'liq to'g'ri va tugal yechim: ${maxScore}
- Asosan to'g'ri, kichik xato: ${Math.round(maxScore * 0.75)}
- Qisman to'g'ri, urinish bor, ba'zi qadamlar to'g'ri: ${half} atrofida
- Juda kam to'g'ri, lekin harakat qilgan: ${Math.round(maxScore * 0.2)}
- Butunlay noto'g'ri yoki bo'sh: 0

Talaba harakat qilgan bo'lsa, hatto qisman to'g'ri bo'lsa ham mos ravishda ball bering.

Faqat quyidagi formatda javob bering:
BALL: [0-${maxScore} oralig'idagi son]
IZOH: [1-2 qator izoh — nima to'g'ri, nima xato]`;

    try {
      const images = questionImageUrl
        ? [questionImageUrl, answerImageUrl]
        : [answerImageUrl];
      const text = await this.callVision(prompt, images);
      const parsed = this.parseGeminiResponse(text);
      // ballni maxScore bilan cheklash
      const score = Math.max(0, Math.min(maxScore, parsed.score));
      return { ...parsed, score };
    } catch (err: any) {
      this.logger.error(`checkChemistryAnswer xatolik: ${err.message}`);
      return { score: 0, comment: 'AI tekshirishda xatolik', status: 'WRONG' };
    }
  }

  // Admin: ballni qo'lda o'zgartirish
  async manualScore(answerId: number, score: number, comment?: string) {
    const ans = await this.prisma.answer.update({
      where: { id: answerId },
      data: {
        aiScore: score,
        aiComment: comment,
        aiStatus: 'MANUAL',
      },
    });
    await this.recalcAttemptScore(ans.attemptId);
    return ans;
  }

  // Admin: qayta yuborish
  async recheck(answerId: number) {
    return this.prisma.answer.update({
      where: { id: answerId },
      data: { aiStatus: 'RECHECK' },
    });
  }

  // Admin: AI tekshiruv holatlari ro'yxati
  async getPendingReviews() {
    return this.prisma.answer.findMany({
      where: { aiStatus: { in: ['PENDING', 'RECHECK'] } },
      include: {
        question: { select: { text: true, qType: true } },
        attempt: {
          include: {
            user: { select: { name: true, phone: true } },
            test: { select: { title: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async recalcAttemptScore(attemptId: number) {
    const attempt = await this.prisma.attempt.findUnique({ where: { id: attemptId } });
    if (!attempt) return;

    const answers = await this.prisma.answer.findMany({ where: { attemptId } });
    const tqs = await this.prisma.testQuestion.findMany({ where: { testId: attempt.testId } });
    const spMap = new Map(tqs.map((t) => [t.orderNo, t.scorePoint || 1]));

    let totalScored = 0;
    let totalPossible = 0;

    for (const tq of tqs) {
      totalPossible += tq.scorePoint || 1;
    }

    for (const a of answers) {
      if (a.orderNo == null) continue;
      const sp = spMap.get(a.orderNo) || 1;
      if (a.aiScore !== null && a.aiScore !== undefined) {
        // AI savol (41-43): AI bergan ballni to'g'ridan-to'g'ri qo'shamiz
        totalScored += a.aiScore;
      } else if (a.isCorrect) {
        totalScored += sp;
      }
    }

    const scorePercent = totalPossible > 0 ? (totalScored / totalPossible) * 100 : 0;

    await this.prisma.attempt.update({
      where: { id: attemptId },
      data: {
        totalScore: Math.round(totalScored * 10) / 10,
        score: Math.round(scorePercent * 10) / 10,
      },
    });
  }

  private buildPrompt(questionText: string, qType: string): string {
    if (qType === 'REACTIONS') {
      return `Kimyo o'qituvchisi sifatida ushbu rasmni baholang.
Savol: ${questionText}
Talaba barcha reaksiya tenglamalarini bitta qog'ozga yozgan.
Quyidagi formatda javob bering:
BALL: [0-100 oralig'ida son]
IZOH: [qisqa baholash izohi]`;
    }
    return `Kimyo o'qituvchisi sifatida ushbu rasmni baholang.
Savol: ${questionText}
Talaba o'z javobini rasmda yozgan.
Quyidagi formatda javob bering:
BALL: [0-100 oralig'ida son]
IZOH: [qisqa baholash izohi]`;
  }

  private parseGeminiResponse(text: string): GeminiResult {
    const scoreMatch = text.match(/BALL:\s*(\d+)/);
    const commentMatch = text.match(/IZOH:\s*(.+)/);

    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
    const comment = commentMatch ? commentMatch[1].trim() : text;

    const status: GeminiResult['status'] =
      score >= 85 ? 'CORRECT' : score >= 40 ? 'PARTIAL' : 'WRONG';

    return { score, comment, status };
  }

  private async urlToBase64(url: string): Promise<string> {
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(res.data).toString('base64');
  }
}
