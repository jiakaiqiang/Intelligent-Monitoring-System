import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { Report, ReportSchema } from './schemas/report.schema';
// import { QueueModule } from '../queue/queue.module';
// import { AiModule } from '../ai/ai.module';

// ReportModule 聚合了报告控制器+服务+Mongoose schema，
// 作为 SDK 上报入口的核心模块。
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Report.name, schema: ReportSchema }]),
    // QueueModule,
    // AiModule,
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
