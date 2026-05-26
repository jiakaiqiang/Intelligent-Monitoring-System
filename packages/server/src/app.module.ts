import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from './ai/ai.module';
import { CommonModule } from './common/common.module';
import { ErrorMappingModule } from './error-mapping/error-mapping.module';
import { ErrorReportModule } from './error-report/error-report.module';
import { QueueModule } from './queue/queue.module';
import { ReportModule } from './report/report.module';
import { SourceMapModule } from './sourcemap/sourcemap.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      username: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '123456',
      database: process.env.MYSQL_DB || 'monitor',
      autoLoadEntities: true,
      synchronize: true,
      charset: 'utf8mb4',
    }),
    CommonModule,
    QueueModule,
    ReportModule,
    SourceMapModule,
    ErrorMappingModule,
    ErrorReportModule,
    AiModule,
  ],
})
export class AppModule {}
