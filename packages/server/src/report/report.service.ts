import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportEntity } from './entities/report.entity';

/**
 * ReportService
 * --------------
 * 封装了与报告集合相关的所有数据库操作，包括创建、查询以及 AI 分析结果的更新。
 */
@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(ReportEntity)
    private readonly reportRepository: Repository<ReportEntity>
  ) {}

  /**
   * 将上报的数据落库，并预留钩子触发异步分析（队列/AI）。
   */
  async create(reportData: any): Promise<ReportEntity> {
    const report = this.reportRepository.create({
      projectId: reportData.projectId,
      errorLogs: reportData.errors ?? reportData.errorLogs ?? null,
      performance: reportData.performance ?? null,
      actions: reportData.actions ?? null,
      processedData: reportData.processedData ?? null,
      aiAnalysis: reportData.aiAnalysis ?? null,
    });

    return this.reportRepository.save(report);
  }

  /**
   * 查询指定项目最近的上报（默认 50 条，按创建时间倒序）。
   */
  async findByProject(projectId: string, limit = 50): Promise<ReportEntity[]> {
    return this.reportRepository.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * 将 AI 分析结果写回指定报告，方便 Dashboard 展示。
   */
  async updateAiAnalysis(reportId: string, analysis: string): Promise<ReportEntity | null> {
    await this.reportRepository.update({ id: reportId }, { aiAnalysis: analysis });
    return this.reportRepository.findOne({ where: { id: reportId } });
  }

  /**
   * 保存映射后的错误
   */
  async saveMappedErrors(projectId: string, errors: any[]): Promise<void> {
    try {
      const errorDocs = errors.map((error) =>
        this.reportRepository.create({
          projectId,
          errorLogs: [
            {
              ...error,
              mapped: true,
              mappedStack: error.mappedStack,
              sourceFile: error.sourceFile,
              sourceLine: error.sourceLine,
              sourceColumn: error.sourceColumn,
            },
          ],
          processedData: { mapped: true },
        })
      );

      await this.reportRepository.save(errorDocs);
    } catch (error) {
      console.error('Failed to save mapped errors:', error);
      throw error;
    }
  }
}
