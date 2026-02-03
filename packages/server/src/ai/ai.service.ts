import { Injectable, OnModuleInit } from '@nestjs/common';

// import { QueueService } from '../queue/queue.service';
// import { ReportService } from '../report/report.service';
import { modelAnalysis } from './alModel';

@Injectable()
export class AiService implements OnModuleInit {


  constructor() {
    this.onModuleInit()
  }

  onModuleInit() {
    // if (process.env.ANTHROPIC_API_KEY) {
     
    //   // this.startWorker();
    // }
     
  }

  async analyzeError(errors: any[]) {
   
    const prompt = `分析以下前端错误并提供解决方案：\n${JSON.stringify(errors, null, 2)}`;

    const message = await modelAnalysis(prompt);

    return message
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
