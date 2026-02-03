import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportModule } from './report/report.module';
import { SourceMapModule } from './sourcemap/sourcemap.module';
import { ErrorMappingModule } from './error-mapping/error-mapping.module';
// import { SchedulerModule } from './scheduler/scheduler.module';
// import { AiModule } from './ai/ai.module';
// import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/monitor'),
    ReportModule,
    SourceMapModule,
    ErrorMappingModule,
    // SchedulerModule,
    // AiModule,
    // QueueModule,
  ],
})
export class AppModule {}
