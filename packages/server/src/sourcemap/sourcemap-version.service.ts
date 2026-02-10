import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { SourceMapEntity, SourceMapInfo } from './entities/sourcemap.entity';

@Injectable()
export class SourceMapVersionService {
  constructor(
    @InjectRepository(SourceMapEntity)
    private readonly sourceMapRepository: Repository<SourceMapEntity>
  ) {}

  private getExpiryDate(days = 30): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  async getAllVersions(projectId: string): Promise<any[]> {
    const records = await this.sourceMapRepository.find({
      where: { projectId },
      order: { uploadedAt: 'DESC' },
    });

    const versions = new Map<string, any>();
    for (const record of records) {
      const entry = versions.get(record.version) || {
        version: record.version,
        uploadedAt: record.uploadedAt,
        fileCount: 0,
        totalSize: 0,
        expiresAt: record.expiresAt,
      };
      entry.fileCount += 1;
      entry.totalSize += record.content.length;
      entry.uploadedAt =
        entry.uploadedAt > record.uploadedAt ? entry.uploadedAt : record.uploadedAt;
      entry.expiresAt = record.expiresAt || entry.expiresAt;
      versions.set(record.version, entry);
    }

    return Array.from(versions.values()).sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()
    );
  }

  async createVersion(
    projectId: string,
    version: string,
    sourceMaps: SourceMapInfo[],
    parentVersion?: string
  ): Promise<SourceMapEntity[]> {
    if (!sourceMaps.length) {
      throw new BadRequestException('At least one SourceMap file is required');
    }

    const existing = await this.sourceMapRepository.findOne({ where: { projectId, version } });
    if (existing) {
      throw new BadRequestException(`Version ${version} already exists`);
    }

    const now = new Date();
    const created: SourceMapEntity[] = [];
    for (const sm of sourceMaps) {
      const entity = this.sourceMapRepository.create({
        projectId,
        version,
        filename: sm.filename,
        content: sm.content,
        parentVersion,
        uploadedAt: now,
        expiresAt: this.getExpiryDate(),
      });
      created.push(await this.sourceMapRepository.save(entity));
    }

    if (parentVersion) {
      await this.sourceMapRepository
        .createQueryBuilder()
        .update(SourceMapEntity)
        .set({ expiresAt: this.getExpiryDate(7) })
        .where('projectId = :projectId', { projectId })
        .andWhere('version != :version', { version })
        .andWhere('(parentVersion IS NULL OR parentVersion != :parentVersion)', { parentVersion })
        .execute();
    }

    return created;
  }

  async rollbackToVersion(
    projectId: string,
    targetVersion: string,
    newVersion: string
  ): Promise<SourceMapEntity[]> {
    const sourceMaps = await this.sourceMapRepository.find({
      where: { projectId, version: targetVersion },
    });

    if (!sourceMaps.length) {
      throw new NotFoundException(`Target version ${targetVersion} not found`);
    }

    const payload = sourceMaps.map<SourceMapInfo>((map) => ({
      filename: map.filename,
      content: map.content,
      version: newVersion,
    }));

    return this.createVersion(projectId, newVersion, payload, targetVersion);
  }

  async compareVersions(projectId: string, version1: string, version2: string): Promise<any> {
    const [maps1, maps2] = await Promise.all([
      this.sourceMapRepository.find({ where: { projectId, version: version1 } }),
      this.sourceMapRepository.find({ where: { projectId, version: version2 } }),
    ]);

    const files1 = new Map(maps1.map((m) => [m.filename, m]));
    const files2 = new Map(maps2.map((m) => [m.filename, m]));

    const commonFiles: string[] = [];
    const addedFiles: string[] = [];
    const removedFiles: string[] = [];
    const modifiedFiles: any[] = [];

    for (const [filename, map] of files1.entries()) {
      if (files2.has(filename)) {
        const next = files2.get(filename)!;
        if (map.content !== next.content) {
          modifiedFiles.push({
            filename,
            sizeChange: next.content.length - map.content.length,
            uploadedAtOld: map.uploadedAt,
            uploadedAtNew: next.uploadedAt,
          });
        }
        commonFiles.push(filename);
      } else {
        removedFiles.push(filename);
      }
    }

    for (const filename of files2.keys()) {
      if (!files1.has(filename)) {
        addedFiles.push(filename);
      }
    }

    return {
      commonFiles,
      addedFiles,
      removedFiles,
      modifiedFiles,
    };
  }

  async cleanupExpiredVersions(projectId: string): Promise<{
    cleanedVersions: string[];
    totalFiles: number;
    totalSize: number;
  }> {
    const now = new Date();
    const expired = await this.sourceMapRepository.find({
      where: { projectId, expiresAt: LessThan(now) },
    });

    if (!expired.length) {
      return { cleanedVersions: [], totalFiles: 0, totalSize: 0 };
    }

    const cleanedVersions = Array.from(new Set(expired.map((item) => item.version)));
    const totalFiles = expired.length;
    const totalSize = expired.reduce((sum, file) => sum + file.content.length, 0);

    await this.sourceMapRepository.delete(expired.map((item) => item.id));

    return { cleanedVersions, totalFiles, totalSize };
  }

  async getVersionHistory(projectId: string, limit = 50): Promise<any[]> {
    const records = await this.sourceMapRepository.find({
      where: { projectId },
      order: { uploadedAt: 'DESC' },
      take: limit * 2,
    });

    const unique = new Map<string, any>();
    for (const record of records) {
      if (!unique.has(record.version)) {
        unique.set(record.version, {
          version: record.version,
          uploadedAt: record.uploadedAt,
          fileCount: 1,
          totalSize: record.content.length,
        });
      } else {
        const entry = unique.get(record.version);
        entry.fileCount += 1;
        entry.totalSize += record.content.length;
      }
      if (unique.size >= limit) {
        break;
      }
    }

    return Array.from(unique.values());
  }

  async suggestNewVersion(
    projectId: string,
    currentVersion: string
  ): Promise<{ suggestedVersion: string; reason: string; fileCount: number; sizeChange: number }> {
    const currentEntries = await this.sourceMapRepository.find({
      where: { projectId, version: currentVersion },
    });
    if (!currentEntries.length) {
      throw new NotFoundException(`Current version ${currentVersion} not found`);
    }

    const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentUploads = await this.sourceMapRepository.find({
      where: {
        projectId,
        version: Not(currentVersion),
        uploadedAt: MoreThanOrEqual(threshold),
      },
    });

    if (recentUploads.length > 0) {
      return {
        suggestedVersion: this.generateNextVersion(currentVersion),
        reason: 'New SourceMap files detected',
        fileCount: recentUploads.length,
        sizeChange: recentUploads.reduce((sum, file) => sum + file.content.length, 0),
      };
    }

    const seen = new Set<string>();
    const duplicates = new Set<string>();
    currentEntries.forEach((entry) => {
      if (seen.has(entry.filename)) {
        duplicates.add(entry.filename);
      } else {
        seen.add(entry.filename);
      }
    });

    if (duplicates.size > 0) {
      return {
        suggestedVersion: this.generateNextVersion(currentVersion),
        reason: 'Existing SourceMap files updated',
        fileCount: duplicates.size,
        sizeChange: 0,
      };
    }

    return {
      suggestedVersion: currentVersion,
      reason: 'No updates needed',
      fileCount: 0,
      sizeChange: 0,
    };
  }

  async batchVersionCleanup(
    projectId: string,
    versions: string[]
  ): Promise<{ cleaned: number; errors: string[]; details: string[] }> {
    const errors: string[] = [];
    const details: string[] = [];
    let cleaned = 0;

    for (const version of versions) {
      try {
        const result = await this.sourceMapRepository.delete({ projectId, version });
        if (result.affected) {
          cleaned += 1;
          details.push(`Deleted version ${version} (${result.affected} files)`);
        } else {
          details.push(`Version ${version} not found or already cleaned`);
        }
      } catch (error) {
        errors.push(`Failed to cleanup version ${version}: ${error.message}`);
      }
    }

    return { cleaned, errors, details };
  }

  private generateNextVersion(currentVersion: string): string {
    const parts = currentVersion.split('.');
    if (parts.length >= 2) {
      const patch = parseInt(parts[2] || '0', 10) + 1;
      return `${parts[0]}.${parts[1]}.${patch}`;
    }
    if (parts.length === 1) {
      return `${parts[0]}.0.1`;
    }
    return '1.0.0';
  }

  async getFilesForVersion(projectId: string, version: string): Promise<SourceMapEntity[]> {
    return this.sourceMapRepository.find({
      where: { projectId, version },
      order: { filename: 'ASC' },
    });
  }
}
