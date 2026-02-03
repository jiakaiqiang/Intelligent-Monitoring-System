import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Report extends Document {
  @Prop({ required: true, index: true })
  projectId: string;

  @Prop({ type: Array })
  errorLogs: Array<{
    message: string;
    stack: string;
    type: string;
    timestamp: number;
    url: string;
    userAgent: string;
  }>;

  @Prop({ type: Object })
  performance: {
    fcp?: number;
    lcp?: number;
    fid?: number;
    cls?: number;
    timestamp: number;
  };

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
