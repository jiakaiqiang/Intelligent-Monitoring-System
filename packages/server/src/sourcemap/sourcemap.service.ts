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
    private readonly sourceMapModel: Model<SourceMapDocument>,
  ) {}

  /**
   * 保存 SourceMap
   */
  async create(projectId: string, sourceMaps: SourceMapInfo[]): Promise<SourceMapDocument[]> {
    const documents = [];

    for (const sm of sourceMaps) {
      // 验证必需字段
      if (!sm.filename || !sm.content) {
        throw new BadRequestException('SourceMap must have filename and content');
      }

      // 检查是否已存在相同的 SourceMap
      const existing = await this.sourceMapModel.findOne({
        projectId,
        version: sm.version || 'unknown',
        filename: sm.filename,
      });

      if (existing) {
        // 更新现有的 SourceMap
        existing.content = sm.content;
        existing.updatedAt = new Date();
        documents.push(await existing.save());
      } else {
        // 创建新的 SourceMap
        const document = new this.sourceMapModel({
          projectId,
          version: sm.version || 'unknown',
          filename: sm.filename,
          content: sm.content,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
        });
        documents.push(await document.save());
      }
    }

    return documents;
  }

  /**
   * 查询 SourceMap
   */
  async findOne(query: SourceMapQuery): Promise<SourceMapDocument | null> {
    const { projectId, version, filename } = query;

    const filter: any = { projectId };
    if (version) filter.version = version;
    if (filename) filter.filename = filename;

    return this.sourceMapModel.findOne(filter).exec();
  }

  /**
   * 批量查询 SourceMap
   */
  async find(query: SourceMapQuery): Promise<SourceMapDocument[]> {
    const { projectId, version, filename } = query;

    const filter: any = { projectId };
    if (version) filter.version = version;
    if (filename) filter.filename = filename;

    return this.sourceMapModel.find(filter).exec();
  }

  /**
   * 获取项目指定版本的所有 SourceMap
   */
  async findByProjectAndVersion(
    projectId: string,
    version?: string
  ): Promise<SourceMapDocument[]> {
    const filter: any = { projectId };
    if (version) filter.version = version;

    return this.sourceMapModel.find(filter).exec();
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
    const sourceMaps = await this.findByProjectAndVersion(projectId, version);

    if (!sourceMaps || sourceMaps.length === 0) {
      return null;
    }

    // 1. 优先根据版本和文件名精确匹配
    if (version) {
      const exactMatch = sourceMaps.find(sm =>
        sm.version === version &&
        (sm.filename === `${file}.map` || sm.filename.includes(file))
      );
      if (exactMatch) return exactMatch;
    }

    // 2. 根据文件名匹配
    const filenameMatch = sourceMaps.find(sm =>
      sm.filename === `${file}.map` ||
      sm.filename.endsWith(file) ||
      sm.filename.includes(file)
    );
    if (filenameMatch) return filenameMatch;

    // 3. 如果都没有匹配，返回第一个 SourceMap（最后的选择）
    return sourceMaps[0] || null;
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
}