import { Controller, Get, Patch, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  findAll() { return this.usersService.findAll(); }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.usersService.findOne(id); }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  updateRole(@Param('id', ParseIntPipe) id: number, @Body() body: { role: Role }) {
    return this.usersService.updateRole(id, body.role);
  }

  @Patch('me/name')
  updateName(@CurrentUser() user: any, @Body() body: { name: string }) {
    return this.usersService.updateName(user.id, body.name);
  }
}
