import { Controller, Get, Patch, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'TEACHER')
export class AiController {
  constructor(private aiService: AiService) {}

  @Get('pending')
  getPending() {
    return this.aiService.getPendingReviews();
  }

  @Patch('answers/:id/score')
  manualScore(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { score: number; comment?: string },
  ) {
    return this.aiService.manualScore(id, body.score, body.comment);
  }

  @Patch('answers/:id/recheck')
  recheck(@Param('id', ParseIntPipe) id: number) {
    return this.aiService.recheck(id);
  }

  @Patch('attempts/:id/check')
  checkAttempt(@Param('id', ParseIntPipe) id: number) {
    return this.aiService.checkAttemptAiAnswers(id);
  }
}
