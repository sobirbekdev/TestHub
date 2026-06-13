import { IsInt, IsArray, IsOptional, IsString } from 'class-validator';

export class StartAttemptDto {
  @IsInt()
  testId: number;
}

export class SubmitAnswerDto {
  @IsOptional()
  @IsInt()
  questionId?: number; // Savol asosidagi testlar uchun

  @IsOptional()
  @IsInt()
  orderNo?: number; // Rasm asosidagi testlar uchun (DTM, Milliy Sert, Atestatsiya)

  @IsOptional()
  @IsArray()
  selectedOpts?: string[]; // ["A"], ["A","C"]

  @IsOptional()
  @IsString()
  openText?: string; // 36-40 savollar

  @IsOptional()
  @IsString()
  imageUrl?: string; // 41-43 savollar (AI)
}

export class FinishAttemptDto {
  @IsArray()
  answers: SubmitAnswerDto[];
}
