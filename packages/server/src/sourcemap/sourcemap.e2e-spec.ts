import { EnhancedSourceMapParser } from '@monitor/sdk/core/sourcemap';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SourceMapInfo } from '@monitor/shared/types';

// Mock source-map library
vi.mock('source-map', () => ({
  SourceMapConsumer: vi.fn().mockImplementation(() => ({
    originalPositionFor: vi.fn().mockReturnValue({
      source: 'test.ts',
      line: 10,
      column: 5,
      name: 'testFunction',
    }),
  })),
}));

describe('EnhancedSourceMapParser', () => {
  let parser: EnhancedSourceMapParser;
  const mockSourceMaps: SourceMapInfo[] = [
    {
      filename: 'app.js.map',
      content: btoa(
        JSON.stringify({
          version: 3,
          sources: ['app.ts'],
          names: [],
          mappings: 'AAAA',
          sourceRoot: '/src',
        })
      ),
      version: '1.0.0',
    },
  ];

  beforeEach(() => {
    parser = new EnhancedSourceMapParser();
  });

  describe('parseStackTrace', () => {
    it('should map stack trace to source location', async () => {
      const error = {
        message: 'Test error',
        stack:
          'Error: Test error\n    at testFunction (app.js:1:1)\n    at Object.<anonymous> (app.js:2:2)',
        type: 'js' as const,
        timestamp: Date.now(),
        url: 'http://localhost',
        userAgent: 'vitest',
      };

      const result = await parser.parseStackTrace(error, mockSourceMaps);

      expect(result.stack).toContain('app.ts:10:5');
      expect(result.stack).toContain('testFunction');
    });

    it('should handle mapping without sourceMaps', async () => {
      const error = {
        message: 'Test error',
        stack: 'Error: Test error\n    at testFunction (app.js:1:1)',
        type: 'js' as const,
        timestamp: Date.now(),
        url: 'http://localhost',
        userAgent: 'vitest',
      };

      const result = await parser.parseStackTrace(error);

      expect(result).toEqual(error);
    });

    it('should handle mapping errors gracefully', async () => {
      const error = {
        message: 'Test error',
        stack: 'Error: Test error\n    at testFunction (app.js:1:1)',
        type: 'js' as const,
        timestamp: Date.now(),
        url: 'http://localhost',
        userAgent: 'vitest',
      };

      // Mock invalid source map
      const invalidSourceMap = [
        {
          ...mockSourceMaps[0],
          content: 'invalid',
        },
      ];

      const result = await parser.parseStackTrace(error, invalidSourceMap);

      expect(result).toEqual(error);
    });
  });

  describe('findBestMatch', () => {
    it('should prioritize exact version matches', () => {
      const fileMaps = [
        { filename: 'app.js.map', version: '1.0.0' },
        { filename: 'app.js.map', version: '1.1.0' },
      ];

      const match = parser['findBestMatch']('test-project', 'app.js', '1.0.0', fileMaps);

      expect(match?.version).toBe('1.0.0');
    });

    it('should fall back to filename match', () => {
      const fileMaps = [
        { filename: 'other.js.map', version: '1.0.0' },
        { filename: 'app.js.map', version: '1.1.0' },
      ];

      const match = parser['findBestMatch']('test-project', 'app.js', undefined, fileMaps);

      expect(match?.filename).toBe('app.js.map');
    });
  });
});
