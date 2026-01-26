import { Injectable } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model } from 'mongoose';
// import { Report } from './schemas/report.schema';
// import { QueueService } from '../queue/queue.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ReportService {
  constructor(private aiService: AiService) {}

  async create(reportData: any) {
    console.log('jkq',reportData)
    // const report = new this.reportModel(reportData);
    // await report.save();

    if (reportData.errors?.length > 0) {
      // await this.queueService.push('error-analysis', {
      //   reportId: report._id,
      //   errors: reportData.errorLogs,
      // });
     console.log(reportData.errors,'reportData.errorLogs')
      const analysis = await this.aiService.analyzeError(reportData.errors);
      return { ...reportData, aiAnalysis: analysis };
    }

    return reportData;
  }

  async findByProject(projectId: string, limit = 50) {
    // return this.reportModel
    //   .find({ projectId })
    //   .sort({ createdAt: -1 })
    //   .limit(limit)
    //   .exec();
    return [];
  }

  async updateAiAnalysis(reportId: string, analysis: string) {
    // return this.reportModel.findByIdAndUpdate(
    //   reportId,
    //   { aiAnalysis: analysis },
    //   { new: true },
    // );
    return null;
  }
}
