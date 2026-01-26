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
  createJkq(@Body() jkqData: any) {
    console.log(jkqData,'jkqData',this.reportService)
  return this.reportService.create(jkqData);
  }

  @Get('reports/:projectId')
  async getReports(@Param('projectId') projectId: string) {
    const data = await this.reportService.findByProject(projectId);
    return { data };
  }
}
