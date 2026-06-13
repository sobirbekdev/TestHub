import { IsString, IsInt, IsOptional, IsEnum, IsBoolean, Min, IsArray } from 'class-validator';
import { TestType } from '@prisma/client';

export class CreateTestDto {
  @IsEnum(TestType)
  type: TestType;

  @IsString()
  title: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsInt()
  variantNo?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsInt()
  @Min(1)
  duration: number;

  @IsInt()
  @Min(1)
  totalQ: number;

  @IsOptional()
  @IsString()
  authorName?: string;

  @IsOptional()
  @IsString()
  collectionName?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsString()
  pdfUrl?: string;

  @IsOptional()
  @IsInt()
  telegramId?: number;
}

export class UpdateTestDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  duration?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  authorName?: string;

  @IsOptional()
  @IsString()
  collectionName?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsString()
  pdfUrl?: string;

  @IsOptional()
  @IsInt()
  telegramId?: number;
}

export class UpsertTestQuestionDto {
  @IsInt()
  orderNo: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  questionText?: string;

  @IsOptional()
  @IsString()
  correctAnswer?: string;

  @IsOptional()
  scorePoint?: number;
}

export class TestFilterDto {
  @IsOptional()
  @IsEnum(TestType)
  type?: TestType;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  authorName?: string;

  @IsOptional()
  @IsString()
  collectionName?: string;
}
