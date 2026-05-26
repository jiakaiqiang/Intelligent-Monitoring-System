import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueueService } from '../queue/queue.service';
import { ReportEntity } from '../report/entities/report.entity';
import { modelAnalysis } from './alModel';

const AI_QUEUE_NAME = 'error-analysis';

@Injectable()
export class AiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiService.name);
  private workerTimer?: NodeJS.Timeout;

  constructor(
    @Optional() private readonly queueService: QueueService,
    @InjectRepository(ReportEntity)
    private readonly reportRepository: Repository<ReportEntity>
  ) {}

  onModuleInit() {
    if (process.env.AI_QUEUE_ENABLED !== 'true') {
      return;
    }

    if (!process.env.AI_API_KEY && !process.env.OPENAI_API_KEY) {
      this.logger.warn('AI queue is enabled, but AI_API_KEY is not configured');
      return;
    }

    this.workerTimer = setInterval(() => {
      void this.consumeNextTask();
    }, Number(process.env.AI_QUEUE_INTERVAL_MS || 5000));
  }

  onModuleDestroy() {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
    }
  }

  async analyzeError(payload: any) {
    const errors = Array.isArray(payload) ? payload : payload?.errors;
    const projectId = Array.isArray(payload) ? undefined : payload?.projectId;

    const prompt = [
      '请分析以下前端异常，并给出可能原因、影响范围、排查步骤和修复建议。',
      projectId ? `项目 ID: ${projectId}` : '',
      JSON.stringify(errors ?? payload, null, 2),
    ]
      .filter(Boolean)
      .join('\n\n');

    return modelAnalysis(prompt);
  }

  private async consumeNextTask() {
    if (!this.queueService?.isEnabled()) {
      return;
    }

    const task = await this.queueService.pop(AI_QUEUE_NAME);
    if (!task?.reportId || !task?.errors?.length) {
      return;
    }

    try {
      const analysis = await this.analyzeError({
        projectId: task.projectId,
        errors: task.errors,
      });

      await this.reportRepository.update({ id: task.reportId }, { aiAnalysis: analysis });
    } catch (error) {
      this.logger.error(`AI analysis worker failed for report ${task.reportId}`, error as Error);
    }
  }
}
