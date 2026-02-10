// SourceMapController 测试：mock service 以验证各 REST 端点的行为与异常。
import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SourceMapController } from './sourcemap.controller';
import { SourceMapService } from './sourcemap.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockSourceMapService = {
  create: vi.fn(),
  findByProjectAndVersion: vi.fn(),
  findOne: vi.fn(),
  getByProjectAndVersion: vi.fn(),
  cleanupExpired: vi.fn(),
  advancedSearch: vi.fn(),
  getProjectVersions: vi.fn(),
  bulkOperations: vi.fn(),
  getHealth: vi.fn(),
};

describe('SourceMapController', () => {
  let controller: SourceMapController;

  beforeEach(async () => {
    controller = new SourceMapController(mockSourceMapService as unknown as SourceMapService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('upload', () => {
    it('should upload source maps successfully', async () => {
      const createDto = {
        project: 'test-project',
        version: '1.0.0',
        filename: 'app.js.map',
        sourcemap: 'test-content',
      };

      const mockDocuments = [
        {
          id: '123',
          filename: 'app.js.map',
          version: '1.0.0',
          uploadedAt: new Date(),
        },
      ];

      mockSourceMapService.create.mockResolvedValue(mockDocuments);

      const result = await controller.upload(createDto as any);

      expect(result.success).toBe(true);
      expect(result.data.filename).toBe('app.js.map');
      expect(mockSourceMapService.create).toHaveBeenCalledWith('test-project', [
        {
          filename: 'app.js.map',
          content: 'test-content',
          version: '1.0.0',
        },
      ]);
    });

    it('should throw error for invalid request', async () => {
      mockSourceMapService.create.mockRejectedValue(new BadRequestException('Failed'));

      await expect(
        controller.upload({ project: 'p', version: '1', filename: 'f', sourcemap: '' } as any)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getByProject', () => {
    it('should get source maps by project', async () => {
      const mockResult = {
        data: [
          {
            id: '123',
            filename: 'app.js.map',
            version: '1.0.0',
            uploadedAt: new Date(),
            expiresAt: new Date(),
          },
        ],
        total: 1,
        totalPages: 1,
      };

      mockSourceMapService.findByProjectAndVersion.mockResolvedValue(mockResult);

      const result = await controller.getByProject('test-project', { version: '1.0.0' } as any);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockSourceMapService.findByProjectAndVersion).toHaveBeenCalledWith(
        'test-project',
        '1.0.0',
        1,
        10
      );
    });

    it('should throw error when no source maps found', async () => {
      mockSourceMapService.findByProjectAndVersion.mockResolvedValue({
        data: [],
        total: 0,
        totalPages: 0,
      });

      await expect(
        controller.getByProject('test-project', { version: '1.0.0' } as any)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getByProjectAndVersion', () => {
    it('should get source maps by project and version', async () => {
      const mockDocuments = [
        {
          id: '123',
          filename: 'app.js.map',
          version: '1.0.0',
          uploadedAt: new Date(),
          expiresAt: new Date(),
        },
      ];

      mockSourceMapService.getByProjectAndVersion.mockResolvedValue(mockDocuments);

      const result = await controller.getByProjectAndVersion('test-project', '1.0.0');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockSourceMapService.getByProjectAndVersion).toHaveBeenCalledWith(
        'test-project',
        '1.0.0'
      );
    });
  });

  describe('cleanupExpired', () => {
    it('should cleanup expired source maps', async () => {
      mockSourceMapService.cleanupExpired.mockResolvedValue(5);

      const result = await controller.cleanupExpired();

      expect(result.success).toBe(true);
      expect(result.message).toContain('5');
      expect(mockSourceMapService.cleanupExpired).toHaveBeenCalled();
    });
  });

  describe('health', () => {
    it('should return health status', async () => {
      const mockHealth = {
        status: 'healthy' as const,
        timestamp: new Date(),
        collectionInfo: {
          totalCount: 100,
          size: 1024,
          newestEntry: new Date(),
          oldestEntry: new Date(),
        },
      };

      mockSourceMapService.getHealth.mockResolvedValue(mockHealth);

      const result = await controller.health();

      expect(result.success).toBe(true);
      expect(result.health.status).toBe('healthy');
      expect(mockSourceMapService.getHealth).toHaveBeenCalled();
    });
  });
});
