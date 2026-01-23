import { Injectable, OnModuleInit } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
// import { QueueService } from '../queue/queue.service';
// import { ReportService } from '../report/report.service';

@Injectable()
export class AiService implements OnModuleInit {
  private anthropic: Anthropic;

  constructor() {}

  onModuleInit() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      // this.startWorker();
    }
  }

  async analyzeError(errors: any[]) {
    if (!this.anthropic) return null;

    const prompt = `分析以下前端错误并提供解决方案：\n${JSON.stringify(errors, null, 2)}`;

    const message = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    return message.content[0].type === 'text' ? message.content[0].text : null;
  }

  // private async startWorker() {
  //   setInterval(async () => {
  //     const task = await this.queueService.pop('error-analysis');
  //     if (task) {
  //       const analysis = await this.analyzeError(task.errors);
  //       if (analysis) {
  //         await this.reportService.updateAiAnalysis(task.reportId, analysis);
  //       }
  //     }
  //   }, 5000);
  // }
}
