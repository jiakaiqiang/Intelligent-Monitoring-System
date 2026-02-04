import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ErrorReportEntity, ErrorReportSchema } from '../schemas/error-report.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ErrorReportEntity.name, schema: ErrorReportSchema },
    ]),
  ],
  providers: [],
  exports: [MongooseModule],
})
export class ErrorReportModule {}
