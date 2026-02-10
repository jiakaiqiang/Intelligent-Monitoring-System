import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SourceMapService } from './sourcemap.service';
import { SourceMapEntity } from './entities/sourcemap.entity';

type MockRepository<T = any> = Partial<Record<keyof Repository<T>, Mock>> & {
  create: Mock;
  save: Mock;
  findOne: Mock;
  findAndCount: Mock;
  find: Mock;
  count: Mock;
  delete: Mock;
  createQueryBuilder?: Mock;
};

const createRepositoryMock = (): MockRepository => ({
  create: vi.fn((entity) => entity),
  save: vi.fn(),
  findOne: vi.fn(),
  findAndCount: vi.fn(),
  find: vi.fn(),
  count: vi.fn(),
  delete: vi.fn(),
  createQueryBuilder: vi.fn(),
});

describe('SourceMapService (TypeORM)', () => {
  let service: SourceMapService;
  let repository: MockRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourceMapService,
        {
          provide: getRepositoryToken(SourceMapEntity),
          useValue: createRepositoryMock(),
        },
      ],
    }).compile();

    service = module.get<SourceMapService>(SourceMapService);
    repository = module.get(getRepositoryToken(SourceMapEntity));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should insert new source maps', async () => {
      repository.findOne!.mockResolvedValue(null);
      repository.save!.mockImplementation(async (entity) => ({ id: '1', ...entity }));

      const result = await service.create('project', [
        { filename: 'app.js.map', content: 'content', version: '1.0.0' },
      ]);

      expect(repository.findOne).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(result[0].filename).toBe('app.js.map');
    });

    it('should update existing source map when found', async () => {
      const existing = { id: '1', filename: 'app.js.map', content: 'old', uploadedAt: new Date() };
      repository.findOne!.mockResolvedValue(existing);
      repository.save!.mockImplementation(async (entity) => entity);

      const result = await service.create('project', [
        { filename: 'app.js.map', content: 'new-content', version: '1.0.0' },
      ]);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'new-content' })
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('find & findOne', () => {
    it('should return paginated results', async () => {
      repository.findAndCount!.mockResolvedValue([[{ id: '1' }], 1]);

      const result = await service.find({ projectId: 'project' }, 1, 10);

      expect(repository.findAndCount).toHaveBeenCalled();
      expect(result.total).toBe(1);
    });

    it('should return single source map', async () => {
      repository.findOne!.mockResolvedValue({ id: '1', filename: 'app.js.map' });

      const result = await service.findOne({ projectId: 'project', filename: 'app.js.map' });

      expect(repository.findOne).toHaveBeenCalled();
      expect(result?.filename).toBe('app.js.map');
    });
  });

  describe('getByProjectAndVersion', () => {
    it('should fetch all maps for version', async () => {
      repository.find!.mockResolvedValue([{ id: '1', version: '1.0.0' }]);

      const result = await service.getByProjectAndVersion('project', '1.0.0');

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId: 'project', version: '1.0.0' } })
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired records', async () => {
      repository.delete!.mockResolvedValue({ affected: 5 });

      const deleted = await service.cleanupExpired();

      expect(repository.delete).toHaveBeenCalled();
      expect(deleted).toBe(5);
    });
  });
});
