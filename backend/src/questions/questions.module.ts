import { Module } from '@nestjs/common';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { RandomService } from './random.service';

@Module({
  controllers: [QuestionsController],
  providers: [QuestionsService, RandomService],
  exports: [QuestionsService, RandomService],
})
export class QuestionsModule {}
