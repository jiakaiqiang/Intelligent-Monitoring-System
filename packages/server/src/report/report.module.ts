import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { ReportEntity } from './entities/report.entity';
// import { QueueModule } from '../queue/queue.module';
// import { AiModule } from '../ai/ai.module';

// ReportModule 聚合了报告控制器+服务+TypeORM entity，
// 作为 SDK 上报入口的核心模块。
@Module({
  imports: [
    TypeOrmModule.forFeature([ReportEntity]),
    // QueueModule,
    // AiModule,
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
