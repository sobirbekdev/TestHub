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
import { QuestionsService } from './questions.service';
import {
  CreateQuestionDto,
  UpdateQuestionDto,
  AddToTestDto,
  QuestionFilterDto,
} from './dto/questions.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('questions')
@UseGuards(JwtAuthGuard)
export class QuestionsController {
  constructor(private questionsService: QuestionsService) {}

  // GET /api/questions — barcha savollar (admin)
  @Get()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  findAll(@Query() filter: QuestionFilterDto) {
    return this.questionsService.findAll(filter);
  }

  // GET /api/questions/stats — statistika (admin)
  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER', 'CURATOR')
  getStats() {
    return this.questionsService.getStats();
  }

  // GET /api/questions/by-test/:testId — test savollari (foydalanuvchi)
  @Get('by-test/:testId')
  findByTest(@Param('testId', ParseIntPipe) testId: number) {
    return this.questionsService.findByTest(testId);
  }

  // GET /api/questions/:id — bitta savol (admin)
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.questionsService.findOne(id);
  }

  // POST /api/questions — savol yaratish (admin)
  @Post()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  create(@Body() dto: CreateQuestionDto) {
    return this.questionsService.create(dto);
  }

  // POST /api/questions/bulk — ko'p savol birdan (admin)
  @Post('bulk')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  createBulk(@Body() body: { questions: CreateQuestionDto[] }) {
    return this.questionsService.createBulk(body.questions);
  }

  // PATCH /api/questions/:id — yangilash (admin)
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionsService.update(id, dto);
  }

  // DELETE /api/questions/:id — o'chirish (admin)
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.questionsService.remove(id);
  }

  // POST /api/questions/:id/add-to-test — testga qo'shish (admin)
  @Post(':id/add-to-test')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  addToTest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddToTestDto,
  ) {
    return this.questionsService.addToTest(id, dto);
  }

  // DELETE /api/questions/:id/remove-from-test/:testId — testdan olib tashlash
  @Delete(':id/remove-from-test/:testId')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  removeFromTest(
    @Param('id', ParseIntPipe) id: number,
    @Param('testId', ParseIntPipe) testId: number,
  ) {
    return this.questionsService.removeFromTest(id, testId);
  }

  // PATCH /api/questions/options/:optionId — option yangilash
  @Patch('options/:optionId')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  updateOption(
    @Param('optionId', ParseIntPipe) optionId: number,
    @Body() body: { text?: string; isCorrect?: boolean },
  ) {
    return this.questionsService.updateOption(optionId, body);
  }

  // DELETE /api/questions/options/:optionId — option o'chirish
  @Delete('options/:optionId')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  removeOption(@Param('optionId', ParseIntPipe) optionId: number) {
    return this.questionsService.removeOption(optionId);
  }

  // POST /api/questions/:id/options — option qo'shish
  @Post(':id/options')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'TEACHER')
  addOption(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { label: string; text: string; isCorrect: boolean },
  ) {
    return this.questionsService.addOption(id, body);
  }
}
