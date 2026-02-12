import { Controller, Post, Get, Body, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportService } from './report.service';

/**
 * ReportController
 * ----------------
 * 暴露监控 SDK 的上报接口 `/api/jkq` 及后台调试接口。
 * 目前包含：
 * - `GET /api/report`：临时调试入口，直接返回请求体；
 * - `POST /api/jkq`：SDK 主上报接口，会尝试进行 SourceMap 映射；
 * - `GET /api/reports/:projectId`：查询指定项目的历史报告。
 */
@Controller('api')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  /**
   * 简单的测试接口，用于验证网关/反向代理是否将请求正确转发到服务端。
   */
  @Post('report')
  async createReport(@Body() reportData: any) {
    console.log(reportData, 'reportData12');
    return this.reportService.create(reportData);
  }

  /**
   * 健康检查 / 快速验证服务是否启动。
   */
  @Get('test')
  async test() {
    return { message: 'test' };
  }

  /**
   * SDK 上报入口：
   * 1. 动态加载 ErrorMappingService 进行 SourceMap 映射；
   * 2. 将映射结果合并到报告数据后交给 ReportService 持久化；
   * 3. 若映射失败则兜底保存原始 payload。
   */
  @Post('jkq')
  async createJkq(@Body() jkqData: any) {
    console.log(jkqData, 'jkqData', this.reportService);

    try {
      const { ErrorMappingService } = await import('../error-mapping/error-mapping.service');
      const errorMappingService = new ErrorMappingService(this.reportService, {} as any);

      const processed = await errorMappingService.processReport({
        projectId: jkqData.projectId,
        errors: jkqData.errors,
        sourceMaps: jkqData.sourceMaps,
      });

      // 保存处理后的数据
      const result = await this.reportService.create({
        ...jkqData,
        processedData: processed,
      });

      return result;
    } catch (error) {
      console.error('Error processing report:', error);
      // 如果处理失败，仍然保存原始数据
      return this.reportService.create(jkqData);
    }
  }

  /**
   * 根据项目 ID 查询最近的报告，供 Dashboard 构建列表/趋势图。
   */
  @Get('reports/:projectId')
  async getReports(
    @Param('projectId') projectId: string,
    @Res({ passthrough: true }) res: Response
  ) {
    console.log(projectId, 'projectId');

    const result = await this.reportService.findByProject(projectId);
    res.header('X-Report-Count', result.data.length.toString());
    res.header('Content-Type', 'application/json');
    return result;
  }
}
