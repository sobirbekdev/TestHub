import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private leaderboardService: LeaderboardService) {}

  @Get('global')
  getGlobal() {
    return this.leaderboardService.getGlobal();
  }

  @Get('group/:groupId')
  getByGroup(@Param('groupId', ParseIntPipe) groupId: number) {
    return this.leaderboardService.getByGroup(groupId);
  }

  @Get('daily')
  getDaily() {
    return this.leaderboardService.getDaily();
  }

  @Get('my-stats')
  getMyStats(@CurrentUser() user: any) {
    return this.leaderboardService.getUserStats(user.id);
  }
}
