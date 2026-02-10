import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SourceMapController } from './sourcemap.controller';
import { SourceMapService } from './sourcemap.service';
import { SourceMapVersionController } from './sourcemap-version.controller';
import { SourceMapVersionService } from './sourcemap-version.service';
import { SourceMapEntity } from './entities/sourcemap.entity';

/**
 * SourceMap 模块：统一注册 Controller / Service / Schema。
 *
 * - CacheModule 作为全局缓存（TTL 5 分钟）提升查询性能。
 * - TypeOrmModule.forFeature 注册 SourceMapEntity，供所有依赖注入。
 */

@Module({
  imports: [
    TypeOrmModule.forFeature([SourceMapEntity]),
    CacheModule.register({
      isGlobal: true,
      ttl: 300, // 5 minutes default TTL
      max: 100, // max number of items in cache
    }),
  ],
  controllers: [SourceMapController, SourceMapVersionController],
  providers: [SourceMapService, SourceMapVersionService],
  exports: [SourceMapService, SourceMapVersionService],
})
export class SourceMapModule {}
