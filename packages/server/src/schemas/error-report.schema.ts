import { Document } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export interface ErrorReportInfo {
  projectId: string;          // ties to SourceMap and other project data
  service: string;            // micro‑service / module name
  environment: string;        // dev / staging / prod
  timestamp: Date;            // when the exception occured
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;            // error message (localized)
  stackTrace: string;         // raw stack trace string
  sourceMapId?: string;       // optional reference to a SourceMapDocument
  metadata?: Record<string, string>; // custom tags (userId, requestId, etc.)
}

export type ErrorReportDocument = ErrorReportEntity & Document;

@Schema({ collection: 'error_reports', timestamps: true })
export class ErrorReportEntity {
  @Prop({ required: true, index: true })
  projectId: string;

  @Prop({ required: true })
  service: string;

  @Prop({ required: true })
  environment: string;

  @Prop({ required: true, index: true })
  timestamp: Date;

  @Prop({ required: true, enum: ['low','medium','high','critical'] })
  severity: string;

  @Prop({ required: true })
  message: string;

  @Prop({ required: true })
  stackTrace: string;

  @Prop({ type: String, ref: 'SourceMap' })
  sourceMapId?: string;

  @Prop({ type: Map, of: String, default: new Map() })
  metadata: Map<string, string>;
}

export const ErrorReportSchema = SchemaFactory.createForClass(ErrorReportEntity);
