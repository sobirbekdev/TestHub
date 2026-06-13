import {
  Controller, Get, Post, Patch, Body, Param, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { AttemptsService } from './attempts.service';
import { StartAttemptDto, FinishAttemptDto } from './dto/attempts.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('attempts')
@UseGuards(JwtAuthGuard)
export class AttemptsController {
  constructor(private attemptsService: AttemptsService) {}

  @Post('start')
  start(@CurrentUser() user: any, @Body() dto: StartAttemptDto) {
    return this.attemptsService.start(user.id, dto);
  }

  @Post(':id/finish')
  finish(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FinishAttemptDto,
  ) {
    return this.attemptsService.finish(user.id, id, dto);
  }

  @Get(':id/result')
  getResult(@CurrentUser() user: any, @Param('id', ParseIntPipe) id: number) {
    return this.attemptsService.getResult(user.id, id);
  }

  @Get('history')
  getHistory(@CurrentUser() user: any) {
    return this.attemptsService.getHistory(user.id);
  }

  // Admin: ochiq javobga ball berish
  @Patch('answers/:answerId/grade')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  gradeAnswer(
    @CurrentUser() user: any,
    @Param('answerId', ParseIntPipe) answerId: number,
    @Body() body: { score: number; comment?: string },
  ) {
    return this.attemptsService.gradeOpenAnswer(user.id, answerId, body.score, body.comment);
  }
}
