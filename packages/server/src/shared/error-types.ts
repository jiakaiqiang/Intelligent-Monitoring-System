// 错误和 SourceMap 类型定义（临时）
export interface ErrorInfo {
  message: string;
  stack?: string;
  type: 'js' | 'promise' | 'resource';
  timestamp: number;
  url: string;
  userAgent: string;
  version?: string;
}

export interface SourceMapInfo {
  filename: string;
  content: string;
  version?: string;
}

export interface MappedErrorInfo extends ErrorInfo {
  mappedStack?: string;
  sourceFile?: string;
  sourceLine?: number;
  sourceColumn?: number;
}