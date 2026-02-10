import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

/**
 * Report Schema
 * --------------
 * 存储 SDK 每次上报的原始数据：错误日志、性能指标以及用户行为。
 */
@Schema({ timestamps: true })
export class Report extends Document {
  /**
   * projectId 用于区分不同的接入方，并建立查询索引。
   */
  @Prop({ required: true, index: true })
  projectId: string;

  /**
   * errorLogs 保存原始堆栈与上下文信息，便于后续离线分析。
   */
  @Prop({ type: Array })
  errorLogs: Array<{
    message: string;
    stack: string;
    type: string;
    timestamp: number;
    url: string;
    userAgent: string;
  }>;

  /**
   * performance 继承自浏览器 API，记录关键 Web Vitals。
   */
  @Prop({ type: Object })
  performance: {
    fcp?: number;
    lcp?: number;
    fid?: number;
    cls?: number;
    timestamp: number;
  };

  /**
   * actions 记录用户行为，帮助将错误与真实操作关联。
   */
  @Prop({ type: Array })
  actions: Array<{
    type: string;
    target: string;
    timestamp: number;
  }>;

  // @Prop()
  // aiAnalysis?: string;
}

export const ReportSchema = SchemaFactory.createForClass(Report);
ReportSchema.index({ projectId: 1, createdAt: -1 });
