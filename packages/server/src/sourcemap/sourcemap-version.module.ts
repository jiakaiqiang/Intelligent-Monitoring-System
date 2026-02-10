import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SourceMapVersionController } from './sourcemap-version.controller';
import { SourceMapVersionService } from './sourcemap-version.service';
import { SourceMapEntity } from './entities/sourcemap.entity';

/**
 * SourceMapVersionModule：
 * - 单独拆分版本控制相关逻辑，避免主 SourceMapModule 过于臃肿。
 * - 复用同一份 SourceMapEntity Schema。
 */

@Module({
  imports: [TypeOrmModule.forFeature([SourceMapEntity])],
  controllers: [SourceMapVersionController],
  providers: [SourceMapVersionService],
  exports: [SourceMapVersionService],
})
export class SourceMapVersionModule {}
