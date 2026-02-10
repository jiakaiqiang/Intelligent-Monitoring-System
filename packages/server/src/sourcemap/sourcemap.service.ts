import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import * as sourceMap from 'source-map';
import { SourceMapEntity, SourceMapInfo } from './entities/sourcemap.entity';

export interface SourceMapQuery {
  projectId: string;
  version?: string;
  filename?: string;
}

@Injectable()
export class SourceMapService {
  constructor(
    @InjectRepository(SourceMapEntity)
    private readonly sourceMapRepository: Repository<SourceMapEntity>
  ) {}

  private getExpiryDate(days = 30): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  async create(projectId: string, sourceMaps: SourceMapInfo[]): Promise<SourceMapEntity[]> {
    const results: SourceMapEntity[] = [];

    for (const sm of sourceMaps) {
      if (!sm.filename || !sm.content) {
        throw new BadRequestException('SourceMap must have filename and content');
      }

      const version = sm.version || 'unknown';
      const existing = await this.sourceMapRepository.findOne({
        where: { projectId, version, filename: sm.filename },
      });

      if (existing) {
        existing.content = sm.content;
        existing.uploadedAt = new Date();
        existing.expiresAt = existing.expiresAt ?? this.getExpiryDate();
        results.push(await this.sourceMapRepository.save(existing));
        continue;
      }

      const entity = this.sourceMapRepository.create({
        projectId,
        version,
        filename: sm.filename,
        content: sm.content,
        uploadedAt: new Date(),
        expiresAt: this.getExpiryDate(),
      });
      results.push(await this.sourceMapRepository.save(entity));
    }

    return results;
  }

  async find(
    query: SourceMapQuery,
    page = 1,
    limit = 10
  ): Promise<{ data: SourceMapEntity[]; total: number; totalPages: number }> {
    const filter: Partial<SourceMapEntity> = { projectId: query.projectId };
    if (query.version) filter.version = query.version;
    if (query.filename) filter.filename = query.filename;

    const currentPage = Math.max(1, page);
    const pageSize = Math.max(1, limit);
    const skip = (currentPage - 1) * pageSize;

    const [data, total] = await this.sourceMapRepository.findAndCount({
      where: filter,
      order: { uploadedAt: 'DESC' },
      skip,
      take: pageSize,
    });

    return {
      data,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOne(query: SourceMapQuery): Promise<SourceMapEntity | null> {
    const filter: Partial<SourceMapEntity> = { projectId: query.projectId };
    if (query.version) filter.version = query.version;
    if (query.filename) filter.filename = query.filename;

    return this.sourceMapRepository.findOne({
      where: filter,
      select: {
        id: true,
        filename: true,
        version: true,
        uploadedAt: true,
        expiresAt: true,
        content: true,
      },
    });
  }

  async advancedSearch(
    filter: any,
    page = 1,
    limit = 10,
    sortBy: keyof SourceMapEntity = 'uploadedAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
    includeContent = false
  ): Promise<{
    data: SourceMapEntity[];
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  }> {
    const currentPage = Math.max(1, page);
    const pageSize = Math.max(1, limit);
    const qb = this.sourceMapRepository.createQueryBuilder('s');

    if (filter.projectId) {
      qb.andWhere('s.projectId = :projectId', { projectId: filter.projectId });
    }
    if (filter.version) {
      qb.andWhere('s.version = :version', { version: filter.version });
    }
    if (filter.filename) {
      qb.andWhere('s.filename = :filename', { filename: filter.filename });
    }
    if (filter.search) {
      qb.andWhere('s.filename LIKE :search', { search: `%${filter.search}%` });
    }
    if (filter.expirationStatus) {
      const now = new Date();
      if (filter.expirationStatus === 'expired') {
        qb.andWhere('s.expiresAt IS NOT NULL AND s.expiresAt < :now', { now });
      } else {
        qb.andWhere('(s.expiresAt IS NULL OR s.expiresAt >= :now)', { now });
      }
    }

    const sortableColumns: (keyof SourceMapEntity)[] = [
      'uploadedAt',
      'expiresAt',
      'filename',
      'version',
    ];
    const column = sortableColumns.includes(sortBy) ? sortBy : 'uploadedAt';

    qb.orderBy(`s.${column}`, sortOrder)
      .skip((currentPage - 1) * pageSize)
      .take(pageSize);

    const [data, total] = await qb.getManyAndCount();

    if (!includeContent) {
      data.forEach((item) => {
        if (item.content) {
          item.content = undefined as any;
        }
      });
    }

    return {
      data,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      page: currentPage,
      limit: pageSize,
    };
  }

  async getProjectVersions(projectId: string): Promise<string[]> {
    const rows = await this.sourceMapRepository
      .createQueryBuilder('s')
      .select('DISTINCT s.version', 'version')
      .where('s.projectId = :projectId', { projectId })
      .orderBy('version', 'ASC')
      .getRawMany();

    return rows.map((row) => row.version).filter(Boolean);
  }

  async findByProjectAndVersion(
    projectId: string,
    version?: string,
    page = 1,
    limit = 10
  ): Promise<{ data: SourceMapEntity[]; total: number; totalPages: number }> {
    const filter: Partial<SourceMapEntity> = { projectId };
    if (version) filter.version = version;

    const currentPage = Math.max(1, page);
    const pageSize = Math.max(1, limit);
    const skip = (currentPage - 1) * pageSize;

    const [data, total] = await this.sourceMapRepository.findAndCount({
      where: filter,
      order: { uploadedAt: 'DESC' },
      skip,
      take: pageSize,
    });

    return {
      data,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getByProjectAndVersion(projectId: string, version: string): Promise<SourceMapEntity[]> {
    return this.sourceMapRepository.find({
      where: { projectId, version },
      order: { uploadedAt: 'DESC' },
    });
  }

  async cleanupExpired(): Promise<number> {
    const now = new Date();
    const result = await this.sourceMapRepository.delete({ expiresAt: LessThan(now) });
    return result.affected || 0;
  }

  async bulkDelete(ids: string[]): Promise<number> {
    if (!ids || ids.length === 0) {
      return 0;
    }
    const result = await this.sourceMapRepository.delete({ id: In(ids) });
    return result.affected || 0;
  }

  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: Date;
    collectionInfo?: {
      totalCount: number;
      size: number;
      newestEntry?: Date;
      oldestEntry?: Date;
    };
  }> {
    try {
      const now = new Date();
      const threshold = new Date(now.getTime() - 5 * 60 * 1000);

      const totalCount = await this.sourceMapRepository.count();
      const sizeResult = await this.sourceMapRepository
        .createQueryBuilder('s')
        .select('COALESCE(SUM(CHAR_LENGTH(s.content)), 0)', 'size')
        .getRawOne();
      const size = Number(sizeResult?.size || 0);

      const newestEntry = await this.sourceMapRepository.findOne({
        order: { uploadedAt: 'DESC' },
      });
      const oldestEntry = await this.sourceMapRepository.findOne({
        order: { uploadedAt: 'ASC' },
      });
      const recentCount = await this.sourceMapRepository.count({
        where: { uploadedAt: MoreThanOrEqual(threshold) },
      });

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      if (recentCount === 0) {
        status = 'unhealthy';
      } else if (recentCount < 10) {
        status = 'degraded';
      }

      return {
        status,
        timestamp: now,
        collectionInfo: {
          totalCount,
          size,
          newestEntry: newestEntry?.uploadedAt,
          oldestEntry: oldestEntry?.uploadedAt,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
      };
    }
  }

  async getProjectStats(projectId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    versions: string[];
    expiredCount: number;
    expiringSoonCount: number;
  }> {
    const totalFiles = await this.sourceMapRepository.count({ where: { projectId } });
    const sizeResult = await this.sourceMapRepository
      .createQueryBuilder('s')
      .select('COALESCE(SUM(CHAR_LENGTH(s.content)), 0)', 'size')
      .where('s.projectId = :projectId', { projectId })
      .getRawOne();
    const totalSize = Number(sizeResult?.size || 0);

    const versionsRaw = await this.sourceMapRepository
      .createQueryBuilder('s')
      .select('s.version', 'version')
      .addSelect('COUNT(*)', 'count')
      .where('s.projectId = :projectId', { projectId })
      .groupBy('s.version')
      .orderBy('s.version', 'ASC')
      .getRawMany();
    const versions = versionsRaw.map((row) => row.version);

    const now = new Date();
    const expiredCount = await this.sourceMapRepository.count({
      where: { projectId, expiresAt: LessThan(now) },
    });
    const expiringSoonThreshold = new Date();
    expiringSoonThreshold.setDate(expiringSoonThreshold.getDate() + 7);
    const expiringSoonCount = await this.sourceMapRepository.count({
      where: {
        projectId,
        expiresAt: Between(now, expiringSoonThreshold),
      },
    });

    return {
      totalFiles,
      totalSize,
      versions,
      expiredCount,
      expiringSoonCount,
    };
  }

  async getSourceMapConsumer(
    projectId: string,
    file: string,
    version?: string
  ): Promise<sourceMap.SourceMapConsumer | null> {
    const sourceMapDoc = await this.findBestMatch(projectId, file, version);
    if (!sourceMapDoc) return null;

    try {
      const mapContent = this.decodeBase64(sourceMapDoc.content);
      const map = JSON.parse(mapContent) as sourceMap.RawSourceMap;
      return new sourceMap.SourceMapConsumer(map);
    } catch (error) {
      console.error('Failed to parse SourceMap:', error);
      return null;
    }
  }

  private async findBestMatch(
    projectId: string,
    file: string,
    version?: string
  ): Promise<SourceMapEntity | null> {
    const qb = this.sourceMapRepository
      .createQueryBuilder('s')
      .where('s.projectId = :projectId', { projectId })
      .orderBy('s.uploadedAt', 'DESC')
      .take(100);

    if (version) {
      qb.andWhere('s.version = :version', { version });
    }

    const data = await qb.getMany();
    if (!data.length) {
      return null;
    }

    if (version) {
      const exactMatch = data.find(
        (sm) =>
          sm.version === version && (sm.filename === `${file}.map` || sm.filename.includes(file))
      );
      if (exactMatch) return exactMatch;
    }

    const filenameMatch = data.find(
      (sm) =>
        sm.filename === `${file}.map` || sm.filename.endsWith(file) || sm.filename.includes(file)
    );
    if (filenameMatch) return filenameMatch;

    return data[0] || null;
  }

  private decodeBase64(base64: string): string {
    try {
      return decodeURIComponent(escape(Buffer.from(base64, 'base64').toString('utf-8')));
    } catch {
      return Buffer.from(base64, 'base64').toString('utf-8');
    }
  }
}
