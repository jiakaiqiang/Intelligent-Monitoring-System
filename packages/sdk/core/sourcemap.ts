import { ErrorInfo, SourceMapInfo } from '@monitor/shared/types';
import * as sourceMap from 'source-map';

export interface MappedPosition {
  source: string;
  line: number;
  column: number;
  name?: string;
}

export interface SourceMapCacheItem {
  map: sourceMap.RawSourceMap;
  consumer: sourceMap.SourceMapConsumer;
  timestamp: number;
}

/**
 * 增强的 SourceMap 解析器
 * 支持从上传的 SourceMap 文件中进行解析，并使用缓存提高性能
 */
export class EnhancedSourceMapParser {
  private cache = new Map<string, SourceMapCacheItem>();
  private cacheTimeout = 24 * 60 * 60 * 1000; // 24小时缓存

  /**
   * 解析错误堆栈，映射到源码位置
   */
  async parseStackTrace(
    error: ErrorInfo,
    sourceMaps?: SourceMapInfo[]
  ): Promise<ErrorInfo> {
    if (!error.stack) return error;

    // 如果有 SourceMap 信息，优先使用
    if (sourceMaps && sourceMaps.length > 0) {
      return this.parseWithUploadedSourceMaps(error, sourceMaps);
    }

    // 否则回退到原有的 URL 方式
    return this.parseWithUrlSourceMaps(error);
  }

  /**
   * 使用上传的 SourceMap 文件解析错误
   */
  private async parseWithUploadedSourceMaps(
    error: ErrorInfo,
    sourceMaps: SourceMapInfo[]
  ): Promise<ErrorInfo> {
    const stack = error.stack;
    if (!stack) return error;

    const lines = stack.split('\n');
    const mappedLines: string[] = [];

    for (const line of lines) {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (match) {
        const [, func, file, lineNum, colNum] = match;
        const mapped = await this.mapPositionWithUploadedMap(
          file,
          parseInt(lineNum),
          parseInt(colNum),
          error.version,
          sourceMaps
        );
        if (mapped) {
          mappedLines.push(`at ${func} (${mapped.source}:${mapped.line}:${mapped.column})`);
        } else {
          mappedLines.push(line);
        }
      } else {
        mappedLines.push(line);
      }
    }

    return {
      ...error,
      stack: mappedLines.join('\n'),
    };
  }

  /**
   * 使用 URL 方式解析错误（保持向后兼容）
   */
  private async parseWithUrlSourceMaps(error: ErrorInfo): Promise<ErrorInfo> {
    const parser = new SourceMapParser();
    return parser.parseStackTrace(error);
  }

  /**
   * 使用上传的 SourceMap 映射位置
   */
  private async mapPositionWithUploadedMap(
    file: string,
    line: number,
    column: number,
    version?: string,
    sourceMaps?: SourceMapInfo[]
  ): Promise<MappedPosition | null> {
    if (!sourceMaps || sourceMaps.length === 0) {
      return null;
    }

    // 根据版本和文件名查找对应的 SourceMap
    const sourceMapInfo = this.findBestMatchSourceMap(file, version, sourceMaps);
    if (!sourceMapInfo) {
      return null;
    }

    try {
      // 解码 Base64 内容
      const mapContent = this.decodeBase64(sourceMapInfo.content);
      const map = JSON.parse(mapContent) as sourceMap.RawSourceMap;

      // 创建消费者并缓存
      const consumerKey = `${sourceMapInfo.filename}-${Date.now()}`;
      let cacheItem = this.cache.get(consumerKey);

      if (!cacheItem || Date.now() - cacheItem.timestamp > this.cacheTimeout) {
        const consumer = await new sourceMap.SourceMapConsumer(map);
        cacheItem = {
          map,
          consumer,
          timestamp: Date.now()
        };
        this.cache.set(consumerKey, cacheItem);

        // 在不需要时释放消费者
        setTimeout(() => {
          cacheItem?.consumer.destroy();
          this.cache.delete(consumerKey);
        }, this.cacheTimeout);
      }

      // 执行映射
      const originalPosition = cacheItem.consumer.originalPositionFor({
        line,
        column,
        bias: sourceMap.SourceMapConsumer.LEAST_UPPER_BOUND
      });

      if (originalPosition.source && originalPosition.source !== null) {
        return {
          source: originalPosition.source,
          line: originalPosition.line || line,
          column: originalPosition.column || column,
          name: originalPosition.name || undefined
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to parse SourceMap:', error);
      return null;
    }
  }

  /**
   * 查找最佳匹配的 SourceMap
   */
  private findBestMatchSourceMap(
    file: string,
    version?: string,
    sourceMaps?: SourceMapInfo[]
  ): SourceMapInfo | null {
    if (!sourceMaps) return null;

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
      // 如果解码失败，尝试直接返回
      return atob(base64);
    }
  }

  /**
   * 清理缓存
   */
  public clearCache(): void {
    for (const cacheItem of this.cache.values()) {
      cacheItem.consumer.destroy();
    }
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  public getCacheSize(): number {
    return this.cache.size;
  }
}

/**
 * 保持向后兼容的原始 SourceMap 解析器
 */
class SourceMapParser {
  private cache = new Map<string, any>();

  async parseStackTrace(error: ErrorInfo): Promise<ErrorInfo> {
    if (!error.stack) return error;

    const lines = error.stack.split('\n');
    const mappedLines: string[] = [];

    for (const line of lines) {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (match) {
        const [, func, file, lineNum, colNum] = match;
        const mapped = await this.mapPosition(file, parseInt(lineNum), parseInt(colNum));
        if (mapped) {
          mappedLines.push(`at ${func} (${mapped.source}:${mapped.line}:${mapped.column})`);
        } else {
          mappedLines.push(line);
        }
      } else {
        mappedLines.push(line);
      }
    }

    return {
      ...error,
      stack: mappedLines.join('\n'),
    };
  }

  private async mapPosition(file: string, line: number, column: number) {
    const mapUrl = `${file}.map`;

    try {
      const sourceMap = await this.fetchSourceMap(mapUrl);
      if (!sourceMap) return null;

      return {
        source: sourceMap.sources?.[0] || file,
        line,
        column,
      };
    } catch {
      return null;
    }
  }

  private async fetchSourceMap(url: string): Promise<any> {
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    try {
      const response = await fetch(url);
      if (!response.ok) return null;

      const map = await response.json();
      this.cache.set(url, map);
      return map;
    } catch {
      return null;
    }
  }
}