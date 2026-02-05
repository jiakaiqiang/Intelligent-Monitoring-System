import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SourceMapEntity, SourceMapDocument } from '../schemas/sourcemap.schema';
import { SourceMapInfo } from '../schemas/sourcemap.schema';
import type { Cache } from 'cache-manager';

@Injectable()
export class SourceMapVersionService {
  constructor(
    @InjectModel(SourceMapEntity.name)
    private readonly sourceMapModel: Model<SourceMapDocument>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache
  ) {}

  /**
   * 获取项目所有版本信息
   */
  async getAllVersions(projectId: string): Promise<any[]> {
    const pipeline = [
      { $match: { projectId } },
      {
        $group: {
          _id: '$version',
          uploadedAt: { $max: '$uploadedAt' },
          fileCount: { $sum: 1 },
          totalSize: { $sum: { $strLenCP: '$content' } },
          expiresAt: { $first: '$expiresAt' },
        },
      },
      {
        $sort: { uploadedAt: -1 as -1 },
      },
      {
        $project: {
          version: '$_id',
          uploadedAt: 1,
          fileCount: 1,
          totalSize: 1,
          expiresAt: 1,
          _id: 0,
        },
      },
    ];

    const versions = await this.sourceMapModel.aggregate(pipeline).exec();

    return versions;
  }

  /**
   * 创建新版本
   */
  async createVersion(
    projectId: string,
    version: string,
    sourceMaps: SourceMapInfo[],
    parentVersion?: string
  ): Promise<SourceMapDocument[]> {
    // 检查版本是否已存在
    const existing = await this.sourceMapModel
      .findOne({
        projectId,
        version,
      })
      .exec();

    if (existing) {
      throw new BadRequestException(`Version ${version} already exists`);
    }

    const documents = [];
    const now = new Date();

    for (const sm of sourceMaps) {
      // 创建新文档
      const document = new this.sourceMapModel({
        projectId,
        version,
        filename: sm.filename,
        content: sm.content,
        parentVersion,
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
      });

      documents.push(await document.save());
    }

    // 使旧版本过期（除了父版本）
    if (parentVersion) {
      await this.sourceMapModel.updateMany(
        {
          projectId,
          version: { $ne: version },
          parentVersion: { $ne: parentVersion },
        },
        { expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } // 7天后过期
      );
    }

    // 清除缓存
    // await this.cacheManager.del(`sourcemap:versions:${projectId}`);
    // await this.cacheManager.del(`sourcemap:find:${projectId}`);

    return documents;
  }

  /**
   * 回滚到指定版本
   */
  async rollbackToVersion(
    projectId: string,
    targetVersion: string,
    newVersion: string
  ): Promise<SourceMapDocument[]> {
    // 获取目标版本的所有 SourceMap
    const targetMaps = await this.sourceMapModel
      .find({ projectId, version: targetVersion })
      .lean()
      .exec();

    if (!targetMaps.length) {
      throw new NotFoundException(`Target version ${targetVersion} not found`);
    }

    // 创建新版本作为回滚版本
    const rollbackMaps = targetMaps.map((map) => ({
      filename: map.filename,
      content: map.content,
      version: newVersion,
    }));

    return await this.createVersion(projectId, newVersion, rollbackMaps, targetVersion);
  }

  /**
   * 比较两个版本
   */
  async compareVersions(projectId: string, version1: string, version2: string): Promise<any> {
    const [maps1, maps2] = await Promise.all([
      this.sourceMapModel.find({ projectId, version: version1 }).lean().exec(),
      this.sourceMapModel.find({ projectId, version: version2 }).lean().exec(),
    ]);

    const files1 = new Set(maps1.map((m) => m.filename));
    const files2 = new Set(maps2.map((m) => m.filename));

    const commonFiles = [];
    const addedFiles = [];
    const removedFiles = [];
    const modifiedFiles = [];

    for (const file of files1) {
      if (files2.has(file)) {
        const map1 = maps1.find((m) => m.filename === file);
        const map2 = maps2.find((m) => m.filename === file);

        if (map1.content !== map2.content) {
          modifiedFiles.push({
            filename: file,
            sizeChange: map2.content.length - map1.content.length,
            uploadedAtOld: map1.uploadedAt,
            uploadedAtNew: map2.uploadedAt,
          });
        }
        commonFiles.push(file);
      } else {
        removedFiles.push(file);
      }
    }

    for (const file of files2) {
      if (!files1.has(file)) {
        addedFiles.push(file);
      }
    }

    return {
      commonFiles,
      addedFiles,
      removedFiles,
      modifiedFiles,
    };
  }

  /**
   * 清理过期版本
   */
  async cleanupExpiredVersions(projectId: string): Promise<{
    cleanedVersions: string[];
    totalFiles: number;
    totalSize: number;
  }> {
    const now = new Date();
    const expired = await this.sourceMapModel
      .find({
        projectId,
        expiresAt: { $lt: now },
      })
      .lean()
      .exec();

    const versionsToClean = new Set(expired.map((e) => e.version));
    const fileCount = expired.length;

    // 计算总大小
    const totalSize = expired.reduce((sum, e) => sum + e.content.length, 0);

    // 删除过期文件
    await this.sourceMapModel.deleteMany({
      projectId,
      expiresAt: { $lt: now },
    });

    // 清除缓存
    // for (const version of versionsToClean) {
    //   await this.cacheManager.del(`sourcemap:versions:${projectId}:${version}`);
    // }
    // await this.cacheManager.del(`sourcemap:versions:${projectId}`);

    return {
      cleanedVersions: Array.from(versionsToClean),
      totalFiles: fileCount,
      totalSize,
    };
  }

  /**
   * 获取版本历史
   */
  async getVersionHistory(projectId: string, limit: number = 50): Promise<any[]> {
    // const cacheKey = `sourcemap:history:${projectId}:${limit}`;

    // const cached = await this.cacheManager.get(cacheKey);
    // if (cached) {
    //   return cached;
    // }

    const history = await this.sourceMapModel
      .find({ projectId })
      .select('version uploadedAt')
      .sort({ uploadedAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    // 去重并格式化
    const uniqueVersions = new Map<string, any>();
    for (const item of history) {
      if (!uniqueVersions.has(item.version)) {
        uniqueVersions.set(item.version, {
          version: item.version,
          uploadedAt: item.uploadedAt,
          fileCount: 0,
          totalSize: 0,
        });
      }
      const entry = uniqueVersions.get(item.version);
      entry.fileCount += 1;
    }

    const result = Array.from(uniqueVersions.values())
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
      .slice(0, limit);

    // 缓存结果
    // await this.cacheManager.set(cacheKey, result, 300 * 1000); // 5分钟

    return result;
  }

  /**
   * 自动版本检测和建议
   */
  async suggestNewVersion(
    projectId: string,
    currentVersion: string
  ): Promise<{
    suggestedVersion: string;
    reason: string;
    fileCount: number;
    sizeChange: number;
  }> {
    // 获取当前版本
    const current = await this.sourceMapModel
      .find({ projectId, version: currentVersion })
      .lean()
      .exec();

    if (!current.length) {
      throw new NotFoundException(`Current version ${currentVersion} not found`);
    }

    // 检查是否有未映射的 SourceMap
    const recentUploads = await this.sourceMapModel
      .find({
        projectId,
        version: { $ne: currentVersion },
        uploadedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // 24小时内
      })
      .lean()
      .exec();

    if (recentUploads.length > 0) {
      // 建议新版本
      const suggestedVersion = this.generateNextVersion(currentVersion);
      return {
        suggestedVersion,
        reason: 'New SourceMap files detected',
        fileCount: recentUploads.length,
        sizeChange: recentUploads.reduce((sum, f) => sum + f.content.length, 0),
      };
    }

    // 检查现有文件是否有更新
    const updatedFiles = await this.sourceMapModel.aggregate([
      {
        $match: {
          projectId,
          version: currentVersion,
        },
      },
      {
        $group: {
          _id: '$filename',
          latestUploadedAt: { $max: '$uploadedAt' },
          count: { $sum: 1 },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
    ]);

    if (updatedFiles.length > 0) {
      const suggestedVersion = this.generateNextVersion(currentVersion);
      return {
        suggestedVersion,
        reason: 'Existing SourceMap files updated',
        fileCount: updatedFiles.length,
        sizeChange: 0, // 需要实际计算大小变化
      };
    }

    // 没有需要更新的
    return {
      suggestedVersion: currentVersion,
      reason: 'No updates needed',
      fileCount: 0,
      sizeChange: 0,
    };
  }

  /**
   * 生成下一个版本号
   */
  private generateNextVersion(currentVersion: string): string {
    const parts = currentVersion.split('.');
    if (parts.length >= 2) {
      const patch = parseInt(parts[2] || '0') + 1;
      return `${parts[0]}.${parts[1]}.${patch}`;
    } else if (parts.length === 1) {
      return `${parts[0]}.0.1`;
    }
    return `1.0.1`;
  }

  /**
   * 批量操作：版本清理
   */
  async batchVersionCleanup(
    projectId: string,
    versions: string[]
  ): Promise<{
    cleaned: number;
    errors: string[];
    details: string[];
  }> {
    const errors: string[] = [];
    const details: string[] = [];

    for (const version of versions) {
      try {
        const count = await this.sourceMapModel
          .deleteMany({
            projectId,
            version,
          })
          .exec();

        if (count.deletedCount > 0) {
          details.push(`Deleted version ${version} (${count.deletedCount} files)`);
          // 清除缓存
          await this.cacheManager.del(`sourcemap:versions:${projectId}:${version}`);
        } else {
          details.push(`Version ${version} not found or already cleaned`);
        }
      } catch (error) {
        errors.push(`Failed to cleanup version ${version}: ${error.message}`);
      }
    }

    // 清除总缓存
    // await this.cacheManager.del(`sourcemap:versions:${projectId}`);

    return {
      cleaned: details.length,
      errors,
      details,
    };
  }
}
