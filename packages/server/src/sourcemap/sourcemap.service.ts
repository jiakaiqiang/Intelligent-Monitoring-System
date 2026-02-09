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
   *
   * 1. 校验每个条目必须包含文件名与内容，必要时抛出 400。
   * 2. 如果相同项目 + 版本 + 文件名已存在，则执行覆盖并更新时间，保留其 Mongo _id 以避免额外碎片化。
   * 3. 否则创建一个新的文档，默认过期时间 30 天，便于后续自动清理。
   * 4. 所有文档的持久化操作串行执行，以便在发现无效输入时快速失败并返回错误。
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
   * 查询 SourceMap 并按时间倒序分页返回。
   *
   * - 默认 page/limit 会自动回退到安全值，避免 undefined 或 0 带来的 NaN。
   * - 只根据 projectId + version + filename 组合构建过滤，防止引入多余字段导致查询不命中索引。
   * - 返回 total/totalPages 便于 API 层直接透出分页信息。
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
   * 查询单个 SourceMap。
   *
   * 只选择必要字段（_id、filename、version、上传/过期时间、内容），避免将体积较大的 Mongo 文档全部返回到内存。
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
   * 支持更复杂的过滤条件（例如文件名模糊匹配、状态筛选）。
   *
   * - 首先执行一个轻量聚合管道统计总数，而不是一次性查询全部数据。
   * - sort/projection 参数完全由调用方决定，包含内容时只选择 content 字段以减少无谓数据。
   * - 返回结构中带有 page/limit/totalPages，方便直接用作 REST 响应。
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
   * 拉取指定项目的所有版本（去重 + 排序）。
   *
   * 使用 MongoDB distinct + sort 保证返回值稳定，便于前端渲染版本选择列表。
   */
  async getProjectVersions(projectId: string): Promise<string[]> {
    const result = await this.sourceMapModel.distinct('version', { projectId }).sort();

    return result;
  }

  /**
   * 汇总 SourceMap 集合的健康状态：总数量、近 5 分钟写入量、集合大小等。
   *
   * 通过 Promise.all 并行执行统计查询，减少健康检查的整体响应时间，且任何异常都会回退为 "unhealthy"。
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
   * 获取项目指定版本的 SourceMap 列表，并可选分页。
   *
   * 当 version 为空时返回项目全部 SourceMap，分页参数默认安全值，可直接被控制器调用。
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
   * 获取指定项目 + 版本的所有 SourceMap，不分页，用于导出或下游内部逻辑。
   */
  async getByProjectAndVersion(projectId: string, version: string): Promise<SourceMapDocument[]> {
    const filter: any = { projectId, version };
    const result = await this.sourceMapModel.find(filter).sort({ uploadedAt: -1 }).exec();

    return result;
  }

  /**
   * 删除所有 expiresAt 小于当前时间的文档，返回删除数量，供定时任务/管理端调用。
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.sourceMapModel.deleteMany({
      expiresAt: { $lt: new Date() },
    });

    return result.deletedCount || 0;
  }

  /**
   * 获取 SourceMapConsumer，核心在于根据 projectId + file + version 找到最匹配的文档，并解码 base64 内容。
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
   * 在最近分页结果中挑选最合适的 SourceMap：优先精确匹配版本，其次匹配文件名，最后兜底返回第一个。
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
   * 兼容性 Base64 解码：先尝试 decodeURIComponent(escape(atob()))，失败时降级为 atob，避免某些 UTF-8 内容报错。
   */
  private decodeBase64(base64: string): string {
    try {
      return decodeURIComponent(escape(atob(base64)));
    } catch {
      return atob(base64);
    }
  }

  /**
   * 根据 _id 数组批量删除 SourceMap，常用于后台批处理。
   */
  async bulkDelete(ids: string[]): Promise<number> {
    const result = await this.sourceMapModel.deleteMany({
      _id: { $in: ids },
    });
    return result.deletedCount || 0;
  }

  /**
   * 计算项目层面的概要信息：文件数量、总大小、版本分布、过期状态等。
   *
   * 通过 $facet 一次性获取多个聚合结果，提升性能，最后组装成更易用的对象返回。
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
