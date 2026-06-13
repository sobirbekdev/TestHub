import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TestsModule } from './tests/tests.module';
import { QuestionsModule } from './questions/questions.module';
import { AttemptsModule } from './attempts/attempts.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { UploadModule } from './upload/upload.module';
import { AiModule } from './ai/ai.module';
import { TelegramModule } from './telegram/telegram.module';
import { GroupsModule } from './groups/groups.module';
import { PaymentsModule } from './payments/payments.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TestsModule,
    QuestionsModule,
    AttemptsModule,
    LeaderboardModule,
    UploadModule,
    AiModule,
    TelegramModule,
    GroupsModule,
    PaymentsModule,
    UsersModule,
  ],
})
export class AppModule {}
