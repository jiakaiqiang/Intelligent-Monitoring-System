import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportModule } from './report/report.module';
import { SourceMapModule } from './sourcemap/sourcemap.module';
import { ErrorMappingModule } from './error-mapping/error-mapping.module';
import { ErrorReportModule } from './error-report/error-report.module';
import { AiModule } from './ai/ai.module';
import { CommonModule } from './common/common.module';
import { concatMap } from 'rxjs';
// import { SchedulerModule } from './scheduler/scheduler.module';
// import { QueueModule } from './queue/queue.module';

/**
 * 应用程序根模块
 * 负责导入和组织所有子模块，构成完整的应用程序
 */
@Module({
  imports: [
    // 配置模块，设置为全局模块以便在应用各处访问环境变量
    ConfigModule.forRoot({ isGlobal: true }),
    // MySQL 数据库连接
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
    // 通用工具模块
    CommonModule,
    // 错误报告模块
    ReportModule,
    // SourceMap映射模块
    SourceMapModule,
    // 错误映射模块
    ErrorMappingModule,
    // 错误报告处理模块
    ErrorReportModule,
    // AI分析模块
    AiModule,
    // 调度器模块(暂未启用)
    // SchedulerModule,
    // 队列模块(暂未启用)
    // QueueModule,
  ],
})
export class AppModule {}



 