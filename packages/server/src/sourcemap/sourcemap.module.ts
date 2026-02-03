import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SourceMapController } from './sourcemap.controller';
import { SourceMapService } from './sourcemap.service';
import { SourceMapSchema, SourceMapEntity } from '../schemas/sourcemap.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SourceMapEntity.name, schema: SourceMapSchema }
    ])
  ],
  controllers: [SourceMapController],
  providers: [SourceMapService],
  exports: [SourceMapService]
})
export class SourceMapModule {}