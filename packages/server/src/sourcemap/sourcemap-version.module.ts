import { Module } from '@nestjs/common';
import { SourceMapVersionController } from './sourcemap-version.controller';
import { SourceMapVersionService } from './sourcemap-version.service';
import { SourceMapSchema, SourceMapEntity } from '../schemas/sourcemap.schema';
import { MongooseModule } from '@nestjs/mongoose';

/**
 * SourceMapVersionModule：
 * - 单独拆分版本控制相关逻辑，避免主 SourceMapModule 过于臃肿。
 * - 复用同一份 SourceMapEntity Schema。
 */

@Module({
  imports: [MongooseModule.forFeature([{ name: SourceMapEntity.name, schema: SourceMapSchema }])],
  controllers: [SourceMapVersionController],
  providers: [SourceMapVersionService],
  exports: [SourceMapVersionService],
})
export class SourceMapVersionModule {}
