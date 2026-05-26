import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { QueueModule } from '../queue/queue.module';
import { ReportEntity } from '../report/entities/report.entity';

// AI 模块仅包含一个服务，未来可根据需要引入队列/报告模块。
@Module({
  imports: [QueueModule, TypeOrmModule.forFeature([ReportEntity])],
  providers: [AiService],
  exports: [AiService],
  controllers: [AiController],
})
export class AiModule {}
