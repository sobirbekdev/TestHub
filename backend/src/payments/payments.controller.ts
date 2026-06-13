import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('create')
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: any,
    @Body() body: { testId: number; provider: 'CLICK' | 'PAYME' },
  ) {
    return this.paymentsService.create(user.id, body.testId, body.provider);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  getHistory(@CurrentUser() user: any) {
    return this.paymentsService.getHistory(user.id);
  }

  // Callback endpointlar (Telegram dan ochiq, token yo'q)
  @Post('click/callback')
  clickCallback(@Body() body: any) {
    return this.paymentsService.handleClickCallback(body);
  }

  @Post('payme/callback')
  paymeCallback(@Body() body: any) {
    return this.paymentsService.handlePaymeCallback(body);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  getAll() {
    return this.paymentsService.getAll();
  }
}
