import { Module } from '@nestjs/common';
import { SourceMapVersionController } from './sourcemap-version.controller';
import { SourceMapVersionService } from './sourcemap-version.service';
import { SourceMapSchema, SourceMapEntity } from '../schemas/sourcemap.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SourceMapEntity.name, schema: SourceMapSchema }
    ])
  ],
  controllers: [SourceMapVersionController],
  providers: [SourceMapVersionService],
  exports: [SourceMapVersionService]
})
export class SourceMapVersionModule {}