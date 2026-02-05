import { Module } from '@nestjs/common';
import { ErrorMappingService } from './error-mapping.service';
import { SourceMapModule } from '../sourcemap/sourcemap.module';
import { ReportModule } from '../report/report.module';

@Module({
  imports: [SourceMapModule, ReportModule],
  providers: [ErrorMappingService],
  exports: [ErrorMappingService],
})
export class ErrorMappingModule {}
