import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportModule } from './report/report.module';
import { SourceMapModule } from './sourcemap/sourcemap.module';
import { ErrorMappingModule } from './error-mapping/error-mapping.module';
import { ErrorReportModule } from './error-report/error-report.module';
import { AiModule } from './ai/ai.module';
import { CommonModule } from './common/common.module';
// import { SchedulerModule } from './scheduler/scheduler.module';
// import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/monitor'),
    CommonModule,
    ReportModule,
    SourceMapModule,
    ErrorMappingModule,
    ErrorReportModule,
    AiModule,
    // SchedulerModule,
    // QueueModule,
  ],
})
export class AppModule {}
