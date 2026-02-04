import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { SourceMapController } from './sourcemap.controller';
import { SourceMapService } from './sourcemap.service';
import { SourceMapSchema, SourceMapEntity } from '../schemas/sourcemap.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SourceMapEntity.name, schema: SourceMapSchema }
    ]),
    CacheModule.register({
      isGlobal: true,
      ttl: 300, // 5 minutes default TTL
      max: 100, // max number of items in cache
    }),
  ],
  controllers: [SourceMapController],
  providers: [SourceMapService],
  exports: [SourceMapService]
})
export class SourceMapModule {}