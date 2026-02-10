import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface ReportErrorLog {
  message: string;
  stack?: string;
  type: string;
  timestamp: number;
  url: string;
  userAgent: string;
  version?: string;
  [key: string]: any;
}

export interface ReportPerformanceMetrics {
  fcp?: number;
  lcp?: number;
  fid?: number;
  cls?: number;
  timestamp?: number;
  [key: string]: any;
}

export interface ReportUserAction {
  type: string;
  target?: string;
  path?: string;
  timestamp: number;
  [key: string]: any;
}

@Entity('reports')
@Index('idx_report_project_time', ['projectId', 'createdAt'])
export class ReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  projectId: string;

  @Column({ type: 'json', nullable: true })
  errorLogs?: ReportErrorLog[] | null;

  @Column({ type: 'json', nullable: true })
  performance?: ReportPerformanceMetrics | null;

  @Column({ type: 'json', nullable: true })
  actions?: ReportUserAction[] | null;

  @Column({ type: 'json', nullable: true })
  processedData?: Record<string, any> | null;

  @Column({ type: 'longtext', nullable: true })
  aiAnalysis?: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
