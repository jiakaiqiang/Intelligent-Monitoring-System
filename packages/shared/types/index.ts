export interface ErrorInfo {
  message: string;
  stack?: string;
  type: 'js' | 'promise' | 'resource';
  timestamp: number;
  url: string;
  userAgent: string;
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

export interface ReportData {
  projectId: string;
  errors?: ErrorInfo[];
  performance?: PerformanceMetrics;
  actions?: UserAction[];
}
