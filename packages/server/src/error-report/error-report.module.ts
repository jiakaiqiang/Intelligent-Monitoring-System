import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErrorReportEntity } from './entities/error-report.entity';

// ErrorReportModule 将错误报告集合注册到 Nest IoC，
// 供 ReportService、AI 模块等读取/写入错误数据。
@Module({
  imports: [TypeOrmModule.forFeature([ErrorReportEntity])],
  providers: [],
  exports: [TypeOrmModule],
})
export class ErrorReportModule {}
