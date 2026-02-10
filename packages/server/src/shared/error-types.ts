// 错误和 SourceMap 类型定义（临时）

/**
 * ErrorInfo 描述了 SDK 原始上报的错误结构。
 */
export interface ErrorInfo {
  message: string;
  stack?: string;
  type: 'js' | 'promise' | 'resource';
  timestamp: number;
  url: string;
  userAgent: string;
  version?: string;
}

/**
 * SourceMapInfo 是上传/下载 SourceMap 时使用的数据载荷。
 */
export interface SourceMapInfo {
  filename: string;
  content: string;
  version?: string;
}

/**
 * MappedErrorInfo 扩展了 ErrorInfo，包含 SourceMap 解码后的定位信息。
 */
export interface MappedErrorInfo extends ErrorInfo {
  mappedStack?: string;
  sourceFile?: string;
  sourceLine?: number;
  sourceColumn?: number;
}
