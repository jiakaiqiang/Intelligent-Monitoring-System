export interface ErrorInfo {
  message: string;
  stack?: string;
  type: 'js' | 'promise' | 'resource';
  timestamp: number;
  url: string;
  userAgent: string;
  version?: string; // 项目版本，用于匹配对应的 SourceMap
}

export interface PerformanceMetrics {
  fcp?: number;
  lcp?: number;
  fid?: number;
  cls?: number;
  timestamp: number;
}

export interface UserAction {
  type: 'click' | 'route';
  target?: string;
  path?: string;
  timestamp: number;
}

export interface SourceMapInfo {
  filename: string; // SourceMap 文件名
  content: string; // Base64 编码的 SourceMap 内容
  version?: string; // 可选，如果未在 ErrorInfo 中指定版本
}

export interface ReportData {
  projectId: string;
  errors?: ErrorInfo[];
  performance?: PerformanceMetrics;
  actions?: UserAction[];
  sourceMaps?: SourceMapInfo[]; // 上传的 SourceMap 文件列表
}
