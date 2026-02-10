import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// CommonModule 作为共享模块，集中导出 ConfigModule 等基础能力，
// 以免每个功能模块重复导入相同依赖。
@Module({
  imports: [ConfigModule],
  providers: [],
  exports: [],
})
export class CommonModule {}
