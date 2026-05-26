import { Injectable } from '@nestjs/common';
import { ReportService } from '../report/report.service';
import { SourceMapService } from '../sourcemap/sourcemap.service';
import { ErrorInfo, SourceMapInfo, MappedErrorInfo } from '../shared/error-types';
import * as sourceMap from 'source-map';

/**
 * ErrorMappingService
 * --------------------
 * 负责将 SDK 上报的压缩后堆栈回溯到原始 TypeScript/ESNext 源码。
 *
 * 核心流程：
 * 1. 根据 report 中携带的 SourceMap 或数据库缓存找到合适的 map。
 * 2. 调用 source-map Consumer 进行位置映射。
 * 3. 把结果写回 ReportService，供 Dashboard 可视化展示。
 */
@Injectable()
export class ErrorMappingService {
  /**
   * 简单的内存缓存，key=文件+行列+版本，value=映射结果，减少重复解析 SourceMap 的成本。
   */
  private cache = new Map<string, any>();
  private cacheTimeout = 60 * 1000; // 1分钟缓存

  constructor(
    private readonly reportService: ReportService,
    private readonly sourceMapService: SourceMapService
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
      mappedErrors,
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
      const frame = this.parseStackFrame(line);
      if (frame) {
        const mapped = await this.mapPositionWithSourceMaps(
          frame.file,
          frame.line,
          frame.column,
          error.version,
          sourceMaps
        );
        if (mapped) {
          mappedLines.push(`    at ${frame.functionName} (${mapped.source}:${mapped.line}:${mapped.column})`);
        } else {
          mappedLines.push(line);
        }
      } else {
        mappedLines.push(line);
      }
    }

    return {
      ...error,
      mappedStack: mappedLines.join('\n'),
    } as MappedErrorInfo;
  }

  private parseStackFrame(line: string): null | {
    functionName: string;
    file: string;
    line: number;
    column: number;
  } {
    const chromeMatch = line.match(/^\s*at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/);
    if (chromeMatch) {
      return {
        functionName: chromeMatch[1] || '(anonymous)',
        file: chromeMatch[2],
        line: Number(chromeMatch[3]),
        column: Number(chromeMatch[4]),
      };
    }

    const firefoxMatch = line.match(/^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/);
    if (firefoxMatch) {
      return {
        functionName: firefoxMatch[1] || '(anonymous)',
        file: firefoxMatch[2],
        line: Number(firefoxMatch[3]),
        column: Number(firefoxMatch[4]),
      };
    }

    const fileOnlyMatch = line.match(/(.+\.(?:js|ts|tsx|jsx|vue|mjs|cjs)):(\d+):(\d+)/);
    if (fileOnlyMatch) {
      return {
        functionName: '(anonymous)',
        file: fileOnlyMatch[1],
        line: Number(fileOnlyMatch[2]),
        column: Number(fileOnlyMatch[3]),
      };
    }

    return null;
  }

  private isApplicationSource(file: string): boolean {
    return !/(^|\/)(node_modules|webpack\/bootstrap|webpack-runtime)(\/|$)/.test(file);
  }

  private getStackForMapping(error: ErrorInfo): string {
    return (error as MappedErrorInfo).mappedStack || error.stack || '';
  }

  private getPrimaryMappedFrame(stack: string) {
    const frames = stack
      .split('\n')
      .map((line) => this.parseStackFrame(line))
      .filter((frame): frame is NonNullable<typeof frame> => Boolean(frame));

    return frames.find((frame) => this.isApplicationSource(frame.file)) || frames[0] || null;
  }

  private mergeMappedInfo(stack: string): Partial<MappedErrorInfo> {
    const frame = this.getPrimaryMappedFrame(stack);

    if (!frame) {
      return {
        mappedStack: stack,
      };
    }

    return {
      sourceFile: frame.file,
      sourceLine: frame.line,
      sourceColumn: frame.column,
      mappedStack: stack,
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
    const sourceMapsResult = await this.sourceMapService.findByProjectAndVersion(
      projectId,
      version
    );
    const sourceMaps = sourceMapsResult.data;

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
        bias: sourceMap.SourceMapConsumer.LEAST_UPPER_BOUND,
      });

      // 销毁消费者
      consumer.destroy();

      if (originalPosition.source) {
        const result = {
          source: originalPosition.source,
          line: originalPosition.line || line,
          column: originalPosition.column || column,
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
      const exactMatch = sourceMaps.find(
        (sm) =>
          sm.version === version && (sm.filename === `${file}.map` || sm.filename.includes(file))
      );
      if (exactMatch) return exactMatch;
    }

    // 2. 根据文件名匹配
    const filenameMatch = sourceMaps.find(
      (sm) =>
        sm.filename === `${file}.map` || sm.filename.endsWith(file) || sm.filename.includes(file)
    );
    if (filenameMatch) return filenameMatch;

    // 3. 如果都没有匹配，返回第一个 SourceMap（最后的选择）
    return sourceMaps[0] || null;
  }

  /**
   * 从错误堆栈中提取文件名
   */
  private extractFileFromStack(stack: string): string {
    return this.parseStackFrame(stack)?.file || '';
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
    const stack = this.getStackForMapping(error);
    if (!stack) return {};

    return this.mergeMappedInfo(stack);
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
