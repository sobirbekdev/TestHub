import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private leaderboardService: LeaderboardService) {}

  @Get('global')
  getGlobal(@CurrentUser() user: any) {
    return this.leaderboardService.getGlobal(user.id);
  }

  // Bitta test bo'yicha leaderboard (natija sahifasi uchun)
  @Get('test/:testId')
  getTestLeaderboard(
    @Param('testId', ParseIntPipe) testId: number,
    @Query('groupId') groupId?: string,
  ) {
    return this.leaderboardService.getTestLeaderboard(
      testId,
      groupId ? parseInt(groupId) : undefined,
    );
  }

  @Get('group/:groupId')
  getByGroup(@Param('groupId', ParseIntPipe) groupId: number) {
    return this.leaderboardService.getByGroup(groupId);
  }

  @Get('daily')
  getDaily(@CurrentUser() user: any) {
    return this.leaderboardService.getDaily(user.id);
  }

  @Get('my-stats')
  getMyStats(@CurrentUser() user: any) {
    return this.leaderboardService.getUserStats(user.id);
  }
}
