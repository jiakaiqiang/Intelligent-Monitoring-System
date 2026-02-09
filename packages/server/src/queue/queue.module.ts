import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';

/**
 * QueueModule 暴露 QueueService，方便其它模块注入使用。
 */

@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
