import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface SourceMapInfo {
  filename: string;
  content: string;
  version?: string;
}

@Entity('sourcemaps')
@Index('idx_sourcemap_project_version', ['projectId', 'version'])
@Index('idx_sourcemap_expiration', ['projectId', 'expiresAt'])
export class SourceMapEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 128 })
  projectId: string;

  @Column({ type: 'varchar', length: 64 })
  version: string;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({ type: 'longtext' })
  content: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  parentVersion?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, string> | null;

  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  uploadedAt: Date;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
