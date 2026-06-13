import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { TestsService } from './tests.service';
import { CreateTestDto, UpdateTestDto, TestFilterDto, UpsertTestQuestionDto } from './dto/tests.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('tests')
@UseGuards(JwtAuthGuard)
export class TestsController {
  constructor(private testsService: TestsService) {}

  // GET /api/tests — barcha testlar
  @Get()
  findAll(@Query() filter: TestFilterDto, @CurrentUser() user: any) {
    return this.testsService.findAll(filter, user.id);
  }

  // GET /api/tests/stats — dashboard statistika
  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER', 'CURATOR')
  getStats() {
    return this.testsService.getStats();
  }

  // GET /api/tests/dtm-years — DTM yillar ro'yxati
  @Get('dtm-years')
  getDtmYears() {
    return this.testsService.getDtmYears();
  }

  // GET /api/tests/group — student: o'z guruhi testlari (qulf holati bilan)
  // ⚠️ :id dan OLDIN turishi shart!
  @Get('group')
  getGroupTests(@CurrentUser() user: any) {
    return this.testsService.getGroupTests(user.id);
  }

  // GET /api/tests/:id/info — to'lov tekshiruvisiz asosiy ma'lumot (JWT kerak emas)
  // Bu route JwtAuthGuard dan oldin turishi uchun alohida import kerak emas
  @Get(':id/info')
  findInfo(@Param('id', ParseIntPipe) id: number) {
    return this.testsService.findInfo(id);
  }
  // Note: controller darajasida @UseGuards(JwtAuthGuard) bor lekin bu route token bilan ham ishlaydi

  // GET /api/tests/:id — bitta test
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.testsService.findOne(id, user.id);
  }

  // POST /api/tests — test yaratish (admin)
  @Post()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  create(@Body() dto: CreateTestDto) {
    return this.testsService.create(dto);
  }

  // PATCH /api/tests/collection-cover — kolleksiya muqovasi (barcha variantlarga)
  // ⚠️ Bu :id dan OLDIN turishi shart!
  @Patch('collection-cover')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  updateCollectionCover(
    @Body() body: { authorName: string; collectionName: string; coverImage: string },
  ) {
    return this.testsService.updateCollectionCover(body.authorName, body.collectionName, body.coverImage);
  }

  // PATCH /api/tests/:id — testni yangilash (admin)
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTestDto,
  ) {
    return this.testsService.update(id, dto);
  }

  // DELETE /api/tests/:id — testni o'chirish (faqat super admin)
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.testsService.remove(id);
  }

  // ─── Test savollari (DTM/Milliy Sert/Atestatsiya) ─────────────────────────

  // GET /api/tests/:id/tq — test savollari (barcha login bo'lgan)
  @Get(':id/tq')
  getTestQuestions(@Param('id', ParseIntPipe) id: number) {
    return this.testsService.getTestQuestions(id);
  }

  // GET /api/tests/:id/tq/admin — admin uchun (javoblar bilan)
  @Get(':id/tq/admin')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  getTestQuestionsAdmin(@Param('id', ParseIntPipe) id: number) {
    return this.testsService.getTestQuestions(id, false);
  }

  // POST /api/tests/:id/tq — savol qo'shish/yangilash
  @Post(':id/tq')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  upsertTestQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertTestQuestionDto,
  ) {
    return this.testsService.upsertTestQuestion(id, dto);
  }

  // POST /api/tests/:id/tq/bulk — ko'p savol birdan
  @Post(':id/tq/bulk')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  bulkUpsertTestQuestions(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { questions: UpsertTestQuestionDto[] },
  ) {
    return this.testsService.bulkUpsertTestQuestions(id, body.questions);
  }

  // DELETE /api/tests/:id/tq/:orderNo — savol o'chirish
  @Delete(':id/tq/:orderNo')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  deleteTestQuestion(
    @Param('id', ParseIntPipe) id: number,
    @Param('orderNo', ParseIntPipe) orderNo: number,
  ) {
    return this.testsService.deleteTestQuestion(id, orderNo);
  }

  // POST /api/tests/:id/open-group — guruhga ochish (boshlanish + tugash oynasi)
  @Post(':id/open-group')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER', 'CURATOR')
  openForGroup(
    @Param('id', ParseIntPipe) testId: number,
    @Body() body: { groupId: number; startsAt?: string; endsAt?: string },
  ) {
    return this.testsService.openForGroup(
      testId,
      body.groupId,
      body.startsAt ? new Date(body.startsAt) : undefined,
      body.endsAt ? new Date(body.endsAt) : undefined,
    );
  }

  // POST /api/tests/:id/close-group — guruhdan yopish
  @Post(':id/close-group')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER', 'CURATOR')
  closeForGroup(
    @Param('id', ParseIntPipe) testId: number,
    @Body() body: { groupId: number },
  ) {
    return this.testsService.closeForGroup(testId, body.groupId);
  }

  // GET /api/tests/:id/groups — testga biriktirilgan guruhlar (kurator/admin)
  @Get(':id/groups')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER', 'CURATOR')
  getTestGroupWindows(@Param('id', ParseIntPipe) id: number) {
    return this.testsService.getTestGroupWindows(id);
  }
}
