import { Module } from '@nestjs/common';
import { ErrorMappingService } from './error-mapping.service';
import { SourceMapService } from '../sourcemap/sourcemap.service';
import { ReportService } from '../report/report.service';

@Module({
  providers: [ErrorMappingService, SourceMapService, ReportService],
  exports: [ErrorMappingService]
})
export class ErrorMappingModule {}