import { ErrorInfo, PerformanceMetrics, UserAction, ReportData } from '@monitor/shared/types';
import { generateId, compress } from '@monitor/shared/utils';
import { API_ENDPOINTS } from '@monitor/shared/constants';
import { PerformanceMonitor } from './performance';
import { PluginManager } from '../plugins';
import { RetryManager } from './retry';

export interface MonitorConfig {
  projectId: string;
  reportUrl: string;
  maxErrors?: number;
  sampleRate?: number;
  plugins?: PluginManager;
  enableCompression?: boolean;
  enableRetry?: boolean;
}

export class Monitor {
  private config: MonitorConfig;
  private errorQueue: ErrorInfo[] = [];
  private actionQueue: UserAction[] = [];
  private performanceMetrics?: PerformanceMetrics;
  private performanceMonitor?: PerformanceMonitor;
  private retryManager: RetryManager;

  constructor(config: MonitorConfig) {
    this.config = {
      maxErrors: 10,
      sampleRate: 1,
      enableCompression: false,
      enableRetry: true,
      ...config
    };
    this.retryManager = new RetryManager();
    this.init();
  }

  private init() {
    this.setupErrorHandlers();
    this.setupPerformanceMonitor();
    this.setupActionTracking();
    this.config.plugins?.install(this);
  }

  private setupErrorHandlers() {
    window.addEventListener(
      'error',
      (event) => {
        if (event.target !== window) {
          const target = event.target as HTMLElement;
          const errorInfo: ErrorInfo = {
            message: `Resource failed to load: ${target.tagName}`,
            stack: (target as any).src || (target as any).href,
            type: 'resource',
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent,
          };
          this.addError(errorInfo);
        } else {
          const errorInfo: ErrorInfo = {
            message: event.message,
            stack: event.error?.stack,
            type: 'js',
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent,
          };
          this.addError(errorInfo);
        }
      },
      true
    );

    window.addEventListener('unhandledrejection', (event) => {
      const errorInfo: ErrorInfo = {
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        type: 'promise',
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      };
      this.addError(errorInfo);
    });
  }

  private setupPerformanceMonitor() {
    this.performanceMonitor = new PerformanceMonitor((metrics) => {
      this.performanceMetrics = metrics;
      this.report();
    });
  }

  private setupActionTracking() {
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const action: UserAction = {
        type: 'click',
        target: target.tagName,
        timestamp: Date.now()
      };
      this.actionQueue.push(action);
    });
  }

  private addError(error: ErrorInfo) {
    this.errorQueue.push(error);
    if (this.errorQueue.length >= (this.config.maxErrors || 10)) {
      this.report();
    }
  }

  public async report() {
    if (this.errorQueue.length === 0 && !this.performanceMetrics) return;

    const data: ReportData = {
      projectId: this.config.projectId,
      errors: this.errorQueue.length > 0 ? this.errorQueue : undefined,
      performance: this.performanceMetrics,
      actions: this.actionQueue.length > 0 ? this.actionQueue : undefined,
    };
   console.log(data,'data')
    const url = `${this.config.reportUrl}/api/jkq`;
    const payload = this.config.enableCompression ? compress(data) : JSON.stringify(data);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // if (this.config.enableCompression) {
    //   headers['Content-Encoding'] = 'base64';
    // }
   console.log(url,'urlurlurlurlurlurlurlurlurlurl',payload)
    const sendReport = async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: payload,
      });

      if (!response.ok) {
        throw new Error(`Report failed: ${response.status}`);
      }

      return response;
    };

    try {
      if (this.config.enableRetry) {
        await this.retryManager.retry(sendReport);
      } else {
        await sendReport();
      }

      this.errorQueue = [];
      this.actionQueue = [];
      this.performanceMetrics = undefined;
    } catch (error) {
      console.error('Failed to send report after retries:', error);
    }
  }
}

export default Monitor;
