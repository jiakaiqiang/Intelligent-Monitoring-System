import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Report } from './schemas/report.schema';

export type ReportDocument = Report & Document;

/**
 * ReportService
 * --------------
 * 封装了与报告集合相关的所有数据库操作，包括创建、查询以及 AI 分析结果的更新。
 */
@Injectable()
export class ReportService {
  constructor(@InjectModel(Report.name) private readonly reportModel: Model<ReportDocument>) {}

  /**
   * 将上报的数据落库，并预留钩子触发异步分析（队列/AI）。
   */
  async create(reportData: any) {
    console.log('jkq', reportData);

    const report = new this.reportModel(reportData);
    await report.save();

    if (reportData.errors?.length > 0) {
      // 推送到队列进行错误分析
      // await this.queueService.push('error-analysis', {
      //   reportId: report._id,
      //   errors: reportData.errors,
      // });
      // const analysis = await this.aiService.analyzeError(reportData.errors);
      // return { ...reportData, aiAnalysis: analysis };
    }

    return reportData;
  }

  /**
   * 查询指定项目最近的上报（默认 50 条，按创建时间倒序）。
   */
  async findByProject(projectId: string, limit = 50) {
    return this.reportModel.find({ projectId }).sort({ createdAt: -1 }).limit(limit).exec();
  }

  /**
   * 将 AI 分析结果写回指定报告，方便 Dashboard 展示。
   */
  async updateAiAnalysis(reportId: string, analysis: string) {
    return this.reportModel.findByIdAndUpdate(reportId, { aiAnalysis: analysis }, { new: true });
  }

  /**
   * 保存映射后的错误
   */
  async saveMappedErrors(projectId: string, errors: any[]): Promise<void> {
    try {
      // 为每个映射后的错误创建记录
      const errorDocs = errors.map((error) => ({
        projectId,
        errors: [
          {
            ...error,
            // 标记为已映射
            mapped: true,
            mappedStack: error.mappedStack,
            sourceFile: error.sourceFile,
            sourceLine: error.sourceLine,
            sourceColumn: error.sourceColumn,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      // 批量保存
      await this.reportModel.insertMany(errorDocs);
    } catch (error) {
      console.error('Failed to save mapped errors:', error);
      throw error;
    }
  }
}
