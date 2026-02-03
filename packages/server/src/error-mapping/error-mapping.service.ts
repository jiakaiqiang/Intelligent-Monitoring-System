import { Injectable } from '@nestjs/common';
import { ReportService } from '../report/report.service';
import { SourceMapService } from '../sourcemap/sourcemap.service';
import { ErrorInfo, SourceMapInfo, MappedErrorInfo } from '../shared/error-types';
import * as sourceMap from 'source-map';

@Injectable()
export class ErrorMappingService {
  private cache = new Map<string, any>();
  private cacheTimeout = 60 * 1000; // 1分钟缓存

  constructor(
    private readonly reportService: ReportService,
    private readonly sourceMapService: SourceMapService,
  ) {}

  /**
   * 处理接收到的错误报告，进行 SourceMap 映射
   */
  async processReport(reportData: {
    projectId: string;
    errors?: ErrorInfo[];
    sourceMaps?: SourceMapInfo[];
  }): Promise<{
    originalErrors: ErrorInfo[];
    mappedErrors: MappedErrorInfo[];
  }> {
    const { projectId, errors = [], sourceMaps = [] } = reportData;

    const mappedErrors: MappedErrorInfo[] = [];

    for (const error of errors) {
      try {
        let mappedError = error;

        // 如果上报时包含了 SourceMap，使用它们
        if (sourceMaps.length > 0) {
          mappedError = await this.mapErrorWithSourceMaps(error, sourceMaps);
        } else {
          // 否则从数据库查找对应的 SourceMap
          mappedError = await this.mapErrorWithDatabaseSourceMaps(error, projectId);
        }

        // 提取映射信息用于显示
        const mappedInfo = this.extractMappedInfo(mappedError);
        mappedErrors.push({ ...mappedError, ...mappedInfo });
      } catch (error) {
        console.error('Failed to map error:', error);
        // 映射失败，保留原始错误
        mappedErrors.push(error);
      }
    }

    // 保存映射后的错误
    if (mappedErrors.length > 0) {
      await this.saveMappedErrors(projectId, mappedErrors);
    }

    return {
      originalErrors: errors,
      mappedErrors
    };
  }

  /**
   * 使用上传的 SourceMap 映射错误
   */
  private async mapErrorWithSourceMaps(
    error: ErrorInfo,
    sourceMaps: SourceMapInfo[]
  ): Promise<ErrorInfo> {
    if (!error.stack) return error;

    const lines = error.stack.split('\n');
    const mappedLines: string[] = [];

    for (const line of lines) {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (match) {
        const [, func, file, lineNum, colNum] = match;
        const mapped = await this.mapPositionWithSourceMaps(
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
   * 使用数据库中的 SourceMap 映射错误
   */
  private async mapErrorWithDatabaseSourceMaps(
    error: ErrorInfo,
    projectId: string
  ): Promise<ErrorInfo> {
    if (!error.stack) return error;

    const file = this.extractFileFromStack(error.stack);
    const version = error.version;

    // 从数据库获取 SourceMap
    const sourceMaps = await this.sourceMapService.findByProjectAndVersion(projectId, version);

    if (sourceMaps.length === 0) {
      // 没有找到 SourceMap，返回原始错误
      return error;
    }

    // 使用 SourceMap 进行映射
    return await this.mapErrorWithSourceMaps(error, sourceMaps);
  }

  /**
   * 使用 SourceMap 映射位置
   */
  private async mapPositionWithSourceMaps(
    file: string,
    line: number,
    column: number,
    version?: string,
    sourceMaps?: SourceMapInfo[]
  ): Promise<null | { source: string; line: number; column: number }> {
    if (!sourceMaps || sourceMaps.length === 0) {
      return null;
    }

    // 创建缓存键
    const cacheKey = `${file}:${line}:${column}:${version}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // 查找最佳匹配的 SourceMap
    const sourceMapInfo = this.findBestMatchSourceMap(file, version, sourceMaps);
    if (!sourceMapInfo) {
      return null;
    }

    try {
      // 解码 Base64 内容
      const mapContent = this.decodeBase64(sourceMapInfo.content);
      const map = JSON.parse(mapContent) as sourceMap.RawSourceMap;

      // 创建消费者
      const consumer = await new sourceMap.SourceMapConsumer(map);

      // 执行映射
      const originalPosition = consumer.originalPositionFor({
        line,
        column,
        bias: sourceMap.SourceMapConsumer.LEAST_UPPER_BOUND
      });

      // 销毁消费者
      consumer.destroy();

      if (originalPosition.source) {
        const result = {
          source: originalPosition.source,
          line: originalPosition.line || line,
          column: originalPosition.column || column
        };

        // 缓存结果
        this.cache.set(cacheKey, result);
        setTimeout(() => {
          this.cache.delete(cacheKey);
        }, this.cacheTimeout);

        return result;
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
   * 从错误堆栈中提取文件名
   */
  private extractFileFromStack(stack: string): string {
    const match = stack.match(/at\s+\((.+?):(\d+):(\d+)\)/);
    return match ? match[1] : '';
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

  /**
   * 从映射后的错误堆栈中提取信息
   */
  private extractMappedInfo(error: ErrorInfo): Partial<MappedErrorInfo> {
    if (!error.stack) return {};

    const lines = error.stack.split('\n');
    const lastLine = lines[lines.length - 1];

    const match = lastLine.match(/at\s+.*?\((.+?):(\d+):(\d+)\)/);
    if (match) {
      const [, sourceFile, sourceLine, sourceColumn] = match;
      return {
        sourceFile,
        sourceLine: parseInt(sourceLine),
        sourceColumn: parseInt(sourceColumn),
        mappedStack: error.stack
      };
    }

    return {
      mappedStack: error.stack
    };
  }

  /**
   * 保存映射后的错误到数据库
   */
  private async saveMappedErrors(projectId: string, errors: MappedErrorInfo[]): Promise<void> {
    try {
      // 将映射后的错误保存到报告集合中
      await this.reportService.saveMappedErrors(projectId, errors);
    } catch (error) {
      console.error('Failed to save mapped errors:', error);
      // 不阻止主流程
    }
  }

  /**
   * 清理缓存
   */
  public cleanup(): void {
    this.cache.clear();
  }
}