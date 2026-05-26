import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { ErrorMappingService } from '../error-mapping/error-mapping.service';
import { SourceMapService } from '../sourcemap/sourcemap.service';
import { ReportService } from './report.service';

@Controller('api')
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly sourceMapService: SourceMapService
  ) {}

  @Post('report')
  async createReport(@Body() reportData: any) {
    return this.createProcessedReport(reportData);
  }

  @Post('jkq')
  async createJkq(@Body() reportData: any) {
    return this.createProcessedReport(reportData);
  }

  @Get('test')
  async test() {
    return { message: 'test' };
  }

  @Get('reports/:projectId')
  async getReports(
    @Param('projectId') projectId: string,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.reportService.findByProject(projectId);
    res.header('X-Report-Count', result.data.length.toString());
    res.header('Content-Type', 'application/json');
    return result;
  }

  private async createProcessedReport(reportData: any) {
    try {
      if (Array.isArray(reportData.sourceMaps) && reportData.sourceMaps.length > 0) {
        await this.sourceMapService.create(reportData.projectId, reportData.sourceMaps);
      }

      const errorMappingService = new ErrorMappingService(
        this.reportService,
        this.sourceMapService
      );

      const processed = await errorMappingService.processReport({
        projectId: reportData.projectId,
        errors: reportData.errors,
        sourceMaps: reportData.sourceMaps,
      });

      return this.reportService.create({
        ...reportData,
        processedData: processed,
      });
    } catch (error) {
      console.error('Error processing report:', error);
      return this.reportService.create(reportData);
    }
  }
}
