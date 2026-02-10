// SourceMapVersionController 测试：覆盖版本 CRUD/回滚/批量操作等典型路径。
import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SourceMapVersionController } from './sourcemap-version.controller';
import { SourceMapVersionService } from './sourcemap-version.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockVersionService = {
  getAllVersions: vi.fn(),
  getVersionHistory: vi.fn(),
  createVersion: vi.fn(),
  rollbackToVersion: vi.fn(),
  compareVersions: vi.fn(),
  cleanupExpiredVersions: vi.fn(),
  suggestNewVersion: vi.fn(),
  batchVersionCleanup: vi.fn(),
  getFilesForVersion: vi.fn(),
};

describe('SourceMapVersionController', () => {
  let controller: SourceMapVersionController;

  beforeEach(async () => {
    controller = new SourceMapVersionController(
      mockVersionService as unknown as SourceMapVersionService
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllVersions', () => {
    it('should get all versions for a project', async () => {
      const mockVersions = [
        {
          version: '1.0.0',
          uploadedAt: new Date(),
          fileCount: 5,
          totalSize: 1024,
          expiresAt: new Date(),
        },
        {
          version: '1.1.0',
          uploadedAt: new Date(),
          fileCount: 3,
          totalSize: 512,
          expiresAt: new Date(),
        },
      ];

      mockVersionService.getAllVersions.mockResolvedValue(mockVersions);

      const result = await controller.getAllVersions('test-project');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockVersionService.getAllVersions).toHaveBeenCalledWith('test-project');
    });

    it('should handle missing project id', async () => {
      await expect(controller.getAllVersions('')).rejects.toThrow(BadRequestException);
    });
  });

  describe('createVersion', () => {
    it('should create a new version', async () => {
      const createDto = {
        version: '1.2.0',
        sourceMaps: [
          {
            filename: 'app.js.map',
            content: 'test-content',
          },
        ],
        parentVersion: '1.1.0',
      };

      const mockDocuments = [
        {
          id: '123',
          filename: 'app.js.map',
          version: '1.2.0',
          parentVersion: '1.1.0',
          uploadedAt: new Date(),
        },
      ];

      mockVersionService.createVersion.mockResolvedValue(mockDocuments);

      const result = await controller.createVersion('test-project', createDto);

      expect(result.success).toBe(true);
      expect(result.message).toContain('1.2.0');
      expect(result.data).toHaveLength(1);
      expect(mockVersionService.createVersion).toHaveBeenCalledWith(
        'test-project',
        '1.2.0',
        createDto.sourceMaps,
        '1.1.0'
      );
    });

    it('should handle version already exists', async () => {
      const createDto = {
        version: '1.0.0',
        sourceMaps: [],
      };

      mockVersionService.createVersion.mockRejectedValue(
        new BadRequestException('Version 1.0.0 already exists')
      );

      await expect(controller.createVersion('test-project', createDto)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('rollback', () => {
    it('should rollback to a specific version', async () => {
      const rollbackDto = {
        targetVersion: '1.0.0',
        newVersion: '1.0.1',
      };

      const mockDocuments = [
        {
          id: '456',
          filename: 'app.js.map',
          version: '1.0.1',
          parentVersion: '1.0.0',
          uploadedAt: new Date(),
        },
      ];

      mockVersionService.rollbackToVersion.mockResolvedValue(mockDocuments);

      const result = await controller.rollback('test-project', rollbackDto);

      expect(result.success).toBe(true);
      expect(result.message).toContain('rolled back from 1.0.0');
      expect(mockVersionService.rollbackToVersion).toHaveBeenCalledWith(
        'test-project',
        '1.0.0',
        '1.0.1'
      );
    });

    it('should handle target version not found', async () => {
      const rollbackDto = {
        targetVersion: '0.0.0',
        newVersion: '1.0.1',
      };

      mockVersionService.rollbackToVersion.mockRejectedValue(
        new NotFoundException('Target version 0.0.0 not found')
      );

      await expect(controller.rollback('test-project', rollbackDto)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('compareVersions', () => {
    it('should compare two versions', async () => {
      const compareDto = {
        version1: '1.0.0',
        version2: '1.1.0',
      };

      const mockComparison = {
        commonFiles: ['app.js.map'],
        addedFiles: ['new.js.map'],
        removedFiles: ['old.js.map'],
        modifiedFiles: [
          {
            filename: 'app.js.map',
            sizeChange: 100,
            uploadedAtOld: new Date(),
            uploadedAtNew: new Date(),
          },
        ],
      };

      mockVersionService.compareVersions.mockResolvedValue(mockComparison);

      const result = await controller.compareVersions('test-project', compareDto);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockComparison);
      expect(mockVersionService.compareVersions).toHaveBeenCalledWith(
        'test-project',
        '1.0.0',
        '1.1.0'
      );
    });
  });

  describe('suggestNewVersion', () => {
    it('should suggest a new version', async () => {
      const suggestDto = {
        currentVersion: '1.0.0',
      };

      const mockSuggestion = {
        suggestedVersion: '1.0.1',
        reason: 'New SourceMap files detected',
        fileCount: 3,
        sizeChange: 512,
      };

      mockVersionService.suggestNewVersion.mockResolvedValue(mockSuggestion);

      const result = await controller.suggestNewVersion('test-project', suggestDto);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSuggestion);
      expect(mockVersionService.suggestNewVersion).toHaveBeenCalledWith('test-project', '1.0.0');
    });

    it('should handle current version not found', async () => {
      const suggestDto = {
        currentVersion: '0.0.0',
      };

      mockVersionService.suggestNewVersion.mockRejectedValue(
        new NotFoundException('Current version 0.0.0 not found')
      );

      await expect(controller.suggestNewVersion('test-project', suggestDto)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('cleanupExpired', () => {
    it('should preview cleanup without executing', async () => {
      const cleanupDto = { force: false };

      const mockResult = {
        cleanedVersions: ['1.0.0'],
        totalFiles: 5,
        totalSize: 1024,
      };

      mockVersionService.cleanupExpiredVersions.mockResolvedValue(mockResult);

      const result = await controller.cleanupExpired('test-project', cleanupDto);

      const previewResponse = result.data as any;
      expect(result.success).toBe(true);
      expect(result.message).toContain('Preview cleanup result');
      expect(previewResponse.preview).toEqual(mockResult);
      expect(previewResponse.estimatedSpaceSaved).toBe(mockResult.totalSize);
      expect(previewResponse.versionsToClean).toBe(mockResult.cleanedVersions.length);
    });

    it('should execute cleanup when force is true', async () => {
      const cleanupDto = { force: true };

      const mockResult = {
        cleanedVersions: ['1.0.0'],
        totalFiles: 5,
        totalSize: 1024,
      };

      mockVersionService.cleanupExpiredVersions.mockResolvedValue(mockResult);

      const result = await controller.cleanupExpired('test-project', cleanupDto);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Cleaned up 1 versions');
      expect(result.data).toEqual(mockResult);
    });
  });

  describe('batchDelete', () => {
    it('should require confirmation to proceed', async () => {
      const body = {
        versions: ['1.0.0', '1.1.0'],
        confirm: false,
      };

      const result = await controller.batchDelete('test-project', body);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Please set confirm=true');
    });

    it('should delete specified versions when confirmed', async () => {
      const body = {
        versions: ['1.0.0', '1.1.0'],
        confirm: true,
      };

      const mockResult = {
        cleaned: 2,
        errors: [],
        details: ['Deleted version 1.0.0 (3 files)', 'Deleted version 1.1.0 (2 files)'],
      };

      mockVersionService.batchVersionCleanup.mockResolvedValue(mockResult);

      const result = await controller.batchDelete('test-project', body);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Batch cleanup completed');
      expect(result.data).toEqual(mockResult);
    });

    it('should throw error for empty versions array', async () => {
      const body = {
        versions: [],
        confirm: true,
      };

      await expect(controller.batchDelete('test-project', body)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('getVersionDetails', () => {
    it('should get details for a specific version', async () => {
      // Mock the underlying methods
      const mockVersions = [
        {
          version: '1.0.0',
          uploadedAt: new Date(),
          fileCount: 1,
          totalSize: 512,
          expiresAt: new Date(),
        },
      ];

      mockVersionService.getAllVersions.mockResolvedValue(mockVersions);

      mockVersionService.getFilesForVersion.mockResolvedValue([
        {
          id: 'file-1',
          filename: 'app.js.map',
          content: 'test-content',
          uploadedAt: new Date(),
          expiresAt: new Date(),
        },
      ]);

      const result = await controller.getVersionDetails('test-project', '1.0.0');

      expect(result.success).toBe(true);
      expect(result.data.version).toBe('1.0.0');
      expect(result.data.fileCount).toBe(1);
      expect(result.data.totalSize).toBe(12);
      expect(result.data.files).toHaveLength(1);
    });

    it('should throw error for non-existent version', async () => {
      mockVersionService.getAllVersions.mockResolvedValue([]);

      await expect(controller.getVersionDetails('test-project', '0.0.0')).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
