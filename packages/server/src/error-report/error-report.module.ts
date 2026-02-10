import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ErrorReportEntity, ErrorReportSchema } from '../schemas/error-report.schema';

// ErrorReportModule 将错误报告集合注册到 Nest IoC，
// 供 ReportService、AI 模块等读取/写入错误数据。
@Module({
  imports: [
    MongooseModule.forFeature([{ name: ErrorReportEntity.name, schema: ErrorReportSchema }]),
  ],
  providers: [],
  exports: [MongooseModule],
})
export class ErrorReportModule {}
