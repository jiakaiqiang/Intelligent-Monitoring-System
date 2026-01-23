import { Module } from '@nestjs/common';
// import { MongooseModule } from '@nestjs/mongoose';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
// import { Report, ReportSchema } from './schemas/report.schema';
// import { QueueModule } from '../queue/queue.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    // MongooseModule.forFeature([{ name: Report.name, schema: ReportSchema }]),
    // QueueModule,
    AiModule,
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
