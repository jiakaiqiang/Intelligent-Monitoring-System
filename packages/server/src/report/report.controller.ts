import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ReportService } from './report.service';

@Controller('api')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('report')
  async createReport(@Body() reportData: any) {
    return this.reportService.create(reportData);
  }

  @Get('reports/:projectId')
  async getReports(@Param('projectId') projectId: string) {
    const data = await this.reportService.findByProject(projectId);
    return { data };
  }
}
