import { Test, TestingModule } from '@nestjs/testing';
import { SourceMapService } from './sourcemap.service';
import { getModelToken } from '@nestjs/mongoose';
import { SourceMapEntity } from '../schemas/sourcemap.schema';

const mockModel = {
  find: jest.fn(),
  findOne: jest.fn(),
  countDocuments: jest.fn(),
  distinct: jest.fn(),
  aggregate: jest.fn(),
  deleteMany: jest.fn(),
  lean: jest.fn(),
  select: jest.fn(),
  sort: jest.fn(),
  skip: jest.fn(),
  limit: jest.fn(),
  exec: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  updateMany: jest.fn(),
};

describe('SourceMapService', () => {
  let service: SourceMapService;
  let model: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourceMapService,
        {
          provide: getModelToken(SourceMapEntity.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<SourceMapService>(SourceMapService);
    model = module.get(getModelToken(SourceMapEntity.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create source map documents', async () => {
      const sourceMaps = [
        {
          filename: 'app.js.map',
          content: 'test-content',
        },
      ];

      const mockDocument = {
        id: '123',
        filename: 'app.js.map',
        version: '1.0.0',
        uploadedAt: new Date(),
        save: jest.fn().mockResolvedValue(null),
      };

      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      mockModel.create.mockResolvedValue(mockDocument);

      const result = await service.create('test-project', sourceMaps);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('123');
      expect(mockModel.create).toHaveBeenCalled();
    });

    it('should update existing source map', async () => {
      const sourceMaps = [
        {
          filename: 'app.js.map',
          content: 'new-content',
        },
      ];

      const existingDoc = {
        id: '123',
        filename: 'app.js.map',
        version: '1.0.0',
        content: 'old-content',
        uploadedAt: new Date(),
        updatedAt: new Date(),
        save: jest.fn().mockResolvedValue(null),
      };

      mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existingDoc) });

      const result = await service.create('test-project', sourceMaps);

      expect(result).toHaveLength(1);
      expect(existingDoc.content).toBe('new-content');
      expect(existingDoc.updatedAt).toBeDefined();
    });
  });

  describe('find', () => {
    it('should find source maps with caching', async () => {
      const query = {
        projectId: 'test-project',
        version: '1.0.0',
      };

      const mockResult = {
        data: [],
        total: 0,
        totalPages: 0,
      };

      mockModel.countDocuments.mockResolvedValue(0);
      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.find(query, 1, 10);

      expect(result).toEqual(mockResult);
      expect(mockModel.countDocuments).toHaveBeenCalled();
    });

    it('should return cached result', async () => {
      const query = {
        projectId: 'test-project',
        version: '1.0.0',
      };

      const cachedResult = {
        data: [],
        total: 0,
        totalPages: 0,
      };

      mockModel.countDocuments.mockResolvedValue(0);
      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.find(query, 1, 10);

      expect(result).toEqual(cachedResult);
    });
  });

  describe('findOne', () => {
    it('should find single source map', async () => {
      const query = {
        projectId: 'test-project',
        filename: 'app.js.map',
      };

      const mockDocument = {
        id: '123',
        filename: 'app.js.map',
        version: '1.0.0',
      };

      const execMock = jest.fn().mockResolvedValue(mockDocument);
      mockModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({ exec: execMock }),
      });

      const result = await service.findOne(query);

      expect(result).toEqual(mockDocument);
      expect(mockModel.findOne).toHaveBeenCalled();
    });
  });

  describe('getByProjectAndVersion', () => {
    it('should get source maps by project and version', async () => {
      const projectId = 'test-project';
      const version = '1.0.0';

      const mockDocuments = [
        {
          id: '123',
          filename: 'app.js.map',
          version: '1.0.0',
          uploadedAt: new Date(),
          expiresAt: new Date(),
        },
      ];

      const execMock = jest.fn().mockResolvedValue(mockDocuments);
      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({ exec: execMock }),
      });

      const result = await service.getByProjectAndVersion(projectId, version);

      expect(result).toEqual(mockDocuments);
      expect(mockModel.find).toHaveBeenCalled();
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired source maps', async () => {
      const mockResult = {
        deletedCount: 5,
      };

      mockModel.deleteMany.mockResolvedValue(mockResult);

      const result = await service.cleanupExpired();

      expect(result).toBe(5);
      expect(mockModel.deleteMany).toHaveBeenCalledWith({
        expiresAt: { $lt: expect.any(Date) },
      });
    });
  });

  describe('getProjectStats', () => {
    it('should return project statistics', async () => {
      const mockAggregationResult = [
        {
          count: [{ total: 10 }],
          size: [{ totalSize: 1024 }],
          versions: [
            { _id: '1.0.0', count: 5 },
            { _id: '1.1.0', count: 5 },
          ],
          status: [
            { _id: 'active', count: 8 },
            { _id: 'expired', count: 2 },
          ],
        },
      ];

      mockModel.aggregate.mockResolvedValue(mockAggregationResult);

      const result = await service.getProjectStats('test-project');

      expect(result.totalFiles).toBe(10);
      expect(result.totalSize).toBe(1024);
      expect(result.versions).toContain('1.0.0');
      expect(result.versions).toContain('1.1.0');
      expect(result.expiredCount).toBe(2);
    });
  });
});
