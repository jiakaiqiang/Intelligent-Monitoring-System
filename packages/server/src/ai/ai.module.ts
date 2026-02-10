import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
// import { QueueModule } from '../queue/queue.module';
// import { ReportModule } from '../report/report.module';

// AI 模块仅包含一个服务，未来可根据需要引入队列/报告模块。
@Module({
  imports: [],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
