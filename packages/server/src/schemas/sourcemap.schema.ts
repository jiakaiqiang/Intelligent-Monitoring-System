import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export interface SourceMapInfo {
  filename: string;
  content: string;
  version?: string;
}

export type SourceMapDocument = SourceMapEntity & Document;

@Schema({
  timestamps: true,
  collection: 'sourcemaps'
})
export class SourceMapEntity {
  @Prop({ required: true, index: true })
  projectId: string;

  @Prop({ required: true, index: true })
  version: string;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  content: string; // Base64 编码的 SourceMap 内容

  @Prop({ type: Date, default: Date.now })
  uploadedAt: Date;

  @Prop({ type: Date, default: Date.now, index: true })
  expiresAt: Date; // 30天后过期

  @Prop({ type: Map, of: String, default: new Map() })
  metadata: Map<string, string>;

  // 添加 timestamps 字段
  createdAt: Date;
  updatedAt: Date;

  // 索引优化
  static indexes = {
    project_version: {
      projectId: 1,
      version: 1
    },
    project_expires: {
      projectId: 1,
      expiresAt: 1
    }
  };
}

export const SourceMapSchema = SchemaFactory.createForClass(SourceMapEntity);