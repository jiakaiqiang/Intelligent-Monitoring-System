import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface ErrorReportInfo {
  projectId: string;
  service: string;
  environment: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  stackTrace: string;
  sourceMapId?: string;
  metadata?: Record<string, string>;
}

@Entity('error_reports')
@Index('idx_error_report_project', ['projectId'])
@Index('idx_error_report_timestamp', ['timestamp'])
export class ErrorReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  projectId: string;

  @Column({ type: 'varchar', length: 128 })
  service: string;

  @Column({ type: 'varchar', length: 32 })
  environment: string;

  @Column({ type: 'datetime' })
  timestamp: Date;

  @Column({ type: 'varchar', length: 16 })
  severity: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'longtext' })
  stackTrace: string;

  @Column({ type: 'varchar', nullable: true })
  sourceMapId?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, string> | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
