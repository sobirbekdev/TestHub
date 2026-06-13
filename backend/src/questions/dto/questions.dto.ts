import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Difficulty, QuestionType } from '@prisma/client';

export class CreateOptionDto {
  @IsString()
  label: string; // A, B, C, D, E, F

  @IsString()
  text: string;

  @IsBoolean()
  isCorrect: boolean;
}

export class CreateQuestionDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @IsEnum(QuestionType)
  qType: QuestionType;

  @IsOptional()
  @IsInt()
  orderInTest?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOptionDto)
  options?: CreateOptionDto[];
}

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsEnum(QuestionType)
  qType?: QuestionType;
}

export class AddToTestDto {
  @IsInt()
  testId: number;

  @IsInt()
  @Min(1)
  orderNo: number;
}

export class QuestionFilterDto {
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @IsOptional()
  @IsEnum(QuestionType)
  qType?: QuestionType;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  testId?: number;
}
