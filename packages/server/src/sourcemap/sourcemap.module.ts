import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { SourceMapController } from './sourcemap.controller';
import { SourceMapService } from './sourcemap.service';
import { SourceMapVersionController } from './sourcemap-version.controller';
import { SourceMapVersionService } from './sourcemap-version.service';
import { SourceMapSchema, SourceMapEntity } from '../schemas/sourcemap.schema';

/**
 * SourceMap 模块：统一注册 Controller / Service / Schema。
 *
 * - CacheModule 作为全局缓存（TTL 5 分钟）提升查询性能。
 * - MongooseModule.forFeature 注册 SourceMapEntity，供所有依赖注入。
 */

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SourceMapEntity.name, schema: SourceMapSchema }]),
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
