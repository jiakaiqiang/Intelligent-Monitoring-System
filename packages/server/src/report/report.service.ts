import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportEntity } from './entities/report.entity';

export interface ProjectReportResponse {
  status: number;
  message: string;
  data: ReportEntity[];
}

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
    console.log(reportData, 'reportData');
    const report = this.reportRepository.create({
      projectId: reportData.projectId,
      errorLogs: reportData.errors ?? reportData.errorLogs ?? null,
      performance: reportData.performance ?? null,
      actions: reportData.actions ?? null,
      processedData: reportData.processedData ?? null,
      aiAnalysis: reportData.aiAnalysis ?? null,
    });
    console.log(report, 'report');
    return this.reportRepository.save(report);
  }

  /**
   * 查询指定项目最近的上报（默认 50 条，按创建时间倒序）。
   */
  async findByProject(projectId: string, limit = 50): Promise<ProjectReportResponse> {
    console.log(projectId, 'projectId');
    const dataList = await this.reportRepository.find({
   
      order: { createdAt: 'DESC' },
      take: limit,
    });

    const data = dataList.filter((item) => item.errorLogs && item.errorLogs.length > 0);
    let responseList: ReportEntity[] = [];

    switch (projectId) {
      case 'JavaScript':
        responseList = data.filter((item) =>
          item.errorLogs?.some((error) => error.type?.includes('js'))
        );
        break;
      case 'Promise':
        responseList = data.filter((item) =>
          item.errorLogs?.some((error) => error.type?.includes('promise'))
        );
        break;
      case 'Source':
        responseList = data.filter((item) =>
          item.errorLogs?.some((error) => error.type?.includes('source'))
        );
        break;
      case 'performance':
        {
          const list = dataList.filter((item) => item.performance);
          console.log(list ,'wefwfe')
          responseList = list.length > 0 ? [list.pop()] : [];
        }
        break;
      case 'default':
      default:
        responseList = data;
        break;
    }
    return {
      status: 0,
      message: 'success',
      data: responseList,
    };
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
      console.error('保存映射错误数据失败:', error);
      throw error;
    }
  }
}
