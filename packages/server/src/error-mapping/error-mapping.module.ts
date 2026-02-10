import { Module } from '@nestjs/common';
import { ErrorMappingService } from './error-mapping.service';
import { SourceMapModule } from '../sourcemap/sourcemap.module';
import { ReportModule } from '../report/report.module';

// ErrorMappingModule 负责组合 SourceMap 与报告模块，
// 以便 ErrorMappingService 能在抛错时回溯 SourceMap 并生成人类可读的内容。
@Module({
  imports: [SourceMapModule, ReportModule],
  providers: [ErrorMappingService],
  exports: [ErrorMappingService],
})
export class ErrorMappingModule {}
