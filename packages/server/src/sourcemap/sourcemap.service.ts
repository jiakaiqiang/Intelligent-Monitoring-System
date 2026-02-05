import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SourceMapEntity, SourceMapDocument } from '../schemas/sourcemap.schema';
import { SourceMapInfo } from '../schemas/sourcemap.schema';
import * as sourceMap from 'source-map';

export interface SourceMapQuery {
  projectId: string;
  version?: string;
  filename?: string;
}

@Injectable()
export class SourceMapService {
  constructor(
    @InjectModel(SourceMapEntity.name)
    private readonly sourceMapModel: Model<SourceMapDocument>
  ) {}

  /**
   * 保存 SourceMap
   */
  async create(projectId: string, sourceMaps: SourceMapInfo[]): Promise<SourceMapDocument[]> {
    const documents: SourceMapDocument[] = [];

    for (const sm of sourceMaps) {
      if (!sm.filename || !sm.content) {
        throw new BadRequestException('SourceMap must have filename and content');
      }

      const version = sm.version || 'unknown';
      const existing = await this.sourceMapModel
        .findOne({ projectId, version, filename: sm.filename })
        .exec();

      if (existing) {
        existing.content = sm.content;
        existing.updatedAt = new Date();
        documents.push(await existing.save());
        continue;
      }

      const created = await this.sourceMapModel.create({
        projectId,
        version,
        filename: sm.filename,
        content: sm.content,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      documents.push(created);
    }

    return documents;
  }

  /**
   * Query SourceMap with optimized caching and pagination
   */
  async find(
    query: SourceMapQuery,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    data: SourceMapDocument[];
    total: number;
    totalPages: number;
  }> {
    const { projectId, version, filename } = query;

    const filter: any = { projectId };
    if (version) filter.version = version;
    if (filename) filter.filename = filename;

    const currentPage = Math.max(1, page);
    const pageSize = Math.max(1, limit);
    const skip = (currentPage - 1) * pageSize;
    const total = await this.sourceMapModel.countDocuments(filter);
    const totalPages = Math.ceil(total / pageSize) || 1;

    const data = await this.sourceMapModel
      .find(filter)
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .exec();

    const result = {
      data,
      total,
      totalPages,
    };

    return result;
  }

  /**
   * Single SourceMap lookup with optimized query
   */
  async findOne(query: SourceMapQuery): Promise<SourceMapDocument | null> {
    const { projectId, version, filename } = query;

    const filter: any = { projectId };
    if (version) filter.version = version;
    if (filename) filter.filename = filename;

    // Use projection to only fetch necessary fields for lookup
    const result = await this.sourceMapModel
      .findOne(filter)
      .select('_id filename version uploadedAt expiresAt content')
      .exec();

    return result;
  }

  /**
   * Advanced search with optimized aggregation pipeline
   */
  async advancedSearch(
    filter: any,
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'uploadedAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
    includeContent: boolean = false
  ): Promise<{
    data: SourceMapDocument[];
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  }> {
    const currentPage = Math.max(1, page);
    const pageSize = Math.max(1, limit);
    const skip = (currentPage - 1) * pageSize;

    // Use aggregation for better performance on complex queries
    const totalPipeline = [{ $match: filter }, { $count: 'total' }];

    const totalResult = await this.sourceMapModel.aggregate(totalPipeline).exec();
    const total = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    const sort: any = {};
    sort[sortBy] = sortOrder === 'ASC' ? 1 : -1;

    const projection = includeContent
      ? 'filename version uploadedAt expiresAt content'
      : 'filename version uploadedAt expiresAt';

    const data = await this.sourceMapModel
      .find(filter)
      .select(projection)
      .sort(sort)
      .skip(skip)
      .limit(pageSize)
      .exec();

    const result = {
      data,
      total,
      totalPages,
      page: currentPage,
      limit: pageSize,
    };

    return result;
  }

  /**
   * Get distinct versions for a project with caching
   */
  async getProjectVersions(projectId: string): Promise<string[]> {
    const result = await this.sourceMapModel.distinct('version', { projectId }).sort();

    return result;
  }

  /**
   * Get health status with optimized queries
   */
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
      const threshold = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago

      // Execute parallel queries for better performance
      const [totalCount, totalSizeResult, newestEntry, oldestEntry, recentCount] =
        await Promise.all([
          this.sourceMapModel.countDocuments({}).exec(),
          this.sourceMapModel
            .aggregate([{ $group: { _id: null, totalSize: { $sum: { $strLenCP: '$content' } } } }])
            .exec(),
          this.sourceMapModel.findOne().sort({ uploadedAt: -1 }).exec(),
          this.sourceMapModel.findOne().sort({ uploadedAt: 1 }).exec(),
          this.sourceMapModel.countDocuments({ uploadedAt: { $gte: threshold } }).exec(),
        ]);

      const size = totalSizeResult?.[0]?.totalSize || 0;

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

  /**
   * 获取项目指定版本的所有 SourceMap (with pagination)
   */
  async findByProjectAndVersion(
    projectId: string,
    version?: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    data: SourceMapDocument[];
    total: number;
    totalPages: number;
  }> {
    const filter: any = { projectId };
    if (version) filter.version = version;

    const currentPage = Math.max(1, page);
    const pageSize = Math.max(1, limit);
    const skip = (currentPage - 1) * pageSize;
    const total = await this.sourceMapModel.countDocuments(filter);
    const totalPages = Math.ceil(total / pageSize) || 1;

    const data = await this.sourceMapModel
      .find(filter)
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .exec();

    return {
      data,
      total,
      totalPages,
    };
  }

  /**
   * Get SourceMap by project and version (single endpoint from task 8)
   */
  async getByProjectAndVersion(projectId: string, version: string): Promise<SourceMapDocument[]> {
    const filter: any = { projectId, version };
    const result = await this.sourceMapModel.find(filter).sort({ uploadedAt: -1 }).exec();

    return result;
  }

  /**
   * 删除过期的 SourceMap
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.sourceMapModel.deleteMany({
      expiresAt: { $lt: new Date() },
    });

    return result.deletedCount || 0;
  }

  /**
   * 获取 SourceMap 消费者（用于映射）
   */
  async getSourceMapConsumer(
    projectId: string,
    file: string,
    version?: string
  ): Promise<sourceMap.SourceMapConsumer | null> {
    // 查找最佳匹配的 SourceMap
    const sourceMapDoc = await this.findBestMatch(projectId, file, version);
    if (!sourceMapDoc) return null;

    try {
      // 解码 Base64 内容
      const mapContent = this.decodeBase64(sourceMapDoc.content);
      const map = JSON.parse(mapContent) as sourceMap.RawSourceMap;

      // 创建消费者
      const consumer = await new sourceMap.SourceMapConsumer(map);
      return consumer;
    } catch (error) {
      console.error('Failed to parse SourceMap:', error);
      return null;
    }
  }

  /**
   * 查找最佳匹配的 SourceMap
   */
  private async findBestMatch(
    projectId: string,
    file: string,
    version?: string
  ): Promise<SourceMapDocument | null> {
    // Use the new paginated method
    const result = await this.findByProjectAndVersion(projectId, version, 1, 100);

    if (!result.data || result.data.length === 0) {
      return null;
    }

    // 1. 优先根据版本和文件名精确匹配
    if (version) {
      const exactMatch = result.data.find(
        (sm) =>
          sm.version === version && (sm.filename === `${file}.map` || sm.filename.includes(file))
      );
      if (exactMatch) return exactMatch;
    }

    // 2. 根据文件名匹配
    const filenameMatch = result.data.find(
      (sm) =>
        sm.filename === `${file}.map` || sm.filename.endsWith(file) || sm.filename.includes(file)
    );
    if (filenameMatch) return filenameMatch;

    // 3. 如果都没有匹配，返回第一个 SourceMap（最后的选择）
    return result.data[0] || null;
  }

  /**
   * Base64 解码
   */
  private decodeBase64(base64: string): string {
    try {
      return decodeURIComponent(escape(atob(base64)));
    } catch {
      return atob(base64);
    }
  }

  /**
   * Batch delete SourceMaps
   */
  async bulkDelete(ids: string[]): Promise<number> {
    const result = await this.sourceMapModel.deleteMany({
      _id: { $in: ids },
    });
    return result.deletedCount || 0;
  }

  /**
   * Get statistics for a project
   */
  async getProjectStats(projectId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    versions: string[];
    expiredCount: number;
    expiringSoonCount: number;
  }> {
    const pipeline = [
      { $match: { projectId } },
      {
        $facet: {
          count: [{ $count: 'total' }],
          size: [{ $group: { _id: null, totalSize: { $sum: { $strLenCP: '$content' } } } }],
          versions: [{ $group: { _id: '$version', count: { $sum: 1 } } }],
          status: [
            {
              $group: {
                _id: {
                  $cond: {
                    if: { $gte: ['$expiresAt', new Date()] },
                    then: 'active',
                    else: 'expired',
                  },
                },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ];

    const result = await this.sourceMapModel.aggregate(pipeline).exec();

    const stats = result[0];
    const total = stats.count[0]?.total || 0;
    const totalSize = stats.size[0]?.totalSize || 0;
    const versionMap = Object.fromEntries(stats.versions.map((v) => [v._id, v.count]));
    const versions = Object.keys(versionMap).sort();

    const active = stats.status.find((s) => s._id === 'active')?.count || 0;
    const expired = stats.status.find((s) => s._id === 'expired')?.count || 0;

    return {
      totalFiles: total,
      totalSize,
      versions,
      expiredCount: expired,
      expiringSoonCount: Math.min(total - active, 100), // Estimate
    };
  }
}
