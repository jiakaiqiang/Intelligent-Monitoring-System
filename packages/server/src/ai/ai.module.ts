import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
// import { QueueModule } from '../queue/queue.module';
// import { ReportModule } from '../report/report.module';

@Module({
  imports: [],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
