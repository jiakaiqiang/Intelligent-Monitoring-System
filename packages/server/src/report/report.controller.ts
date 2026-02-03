import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ReportService } from './report.service';

@Controller('api')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('report')
  async createReport(@Body() reportData: any) {
    console.log(reportData,'reportData')
    return reportData
    //return this.reportService.create(reportData);
  }
  @Get('test')
  async test() {
    return { message: 'test' };
  }
  @Post('jkq')
  async createJkq(@Body() jkqData: any) {
    console.log(jkqData, 'jkqData', this.reportService);

    // 使用错误映射服务处理上报的数据
    try {
      const { ErrorMappingService } = await import('../error-mapping/error-mapping.service');
      const errorMappingService = new ErrorMappingService(this.reportService, {} as any);

      const processed = await errorMappingService.processReport({
        projectId: jkqData.projectId,
        errors: jkqData.errors,
        sourceMaps: jkqData.sourceMaps
      });

      // 保存处理后的数据
      const result = await this.reportService.create({
        ...jkqData,
        processedData: processed
      });

      return result;
    } catch (error) {
      console.error('Error processing report:', error);
      // 如果处理失败，仍然保存原始数据
      return this.reportService.create(jkqData);
    }
  }

  @Get('reports/:projectId')
  async getReports(@Param('projectId') projectId: string) {
    const data = await this.reportService.findByProject(projectId);
    return { data };
  }
}
