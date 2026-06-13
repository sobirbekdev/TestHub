import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Get()
  findAll() { return this.groupsService.findAll(); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.groupsService.findOne(id); }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER', 'CURATOR')
  create(@Body() body: { name: string }) { return this.groupsService.create(body.name); }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER', 'CURATOR')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: { name: string }) {
    return this.groupsService.update(id, body.name);
  }

  @Patch(':id/curator')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  setCurator(@Param('id', ParseIntPipe) id: number, @Body() body: { curatorId: number | null }) {
    return this.groupsService.setCurator(id, body.curatorId ?? null);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) { return this.groupsService.remove(id); }

  @Post(':id/users')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER', 'CURATOR')
  addUser(@Param('id', ParseIntPipe) id: number, @Body() body: { userId: number }) {
    return this.groupsService.addUser(id, body.userId);
  }

  @Delete('users/:userId')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER', 'CURATOR')
  removeUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.groupsService.removeUser(userId);
  }
}
