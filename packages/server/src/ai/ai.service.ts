import { Injectable, OnModuleInit } from '@nestjs/common';

// import { QueueService } from '../queue/queue.service';
// import { ReportService } from '../report/report.service';
import { modelAnalysis } from './alModel';

/**
 * AiService
 * ---------
 * 用于对错误日志进行 AI 辅助分析，生成修复建议或摘要。
 * 当前实现仅在 `analyzeError` 中直接调用模型，未来可扩展为基于队列的 worker。
 */
@Injectable()
export class AiService implements OnModuleInit {
  constructor() {
    this.onModuleInit();
  }

  /**
   * 模块初始化生命周期钩子，可在具备 API Key 时启动后台任务。
   */
  onModuleInit() {
    // if (process.env.ANTHROPIC_API_KEY) {
    //   // this.startWorker();
    // }
  }

  /**
   * 将错误数组序列化为 prompt，交由 AI 模型输出自然语言分析。
   */
  async analyzeError(errors: any[]) {
    const prompt = `分析以下前端错误并提供解决方案：\n${JSON.stringify(errors, null, 2)}`;

    const message = await modelAnalysis(prompt);

    return message;
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
