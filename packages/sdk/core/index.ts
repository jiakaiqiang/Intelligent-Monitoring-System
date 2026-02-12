import { ErrorInfo, PerformanceMetrics, UserAction, ReportData } from '@monitor/shared/types';
import { generateId, compress } from '@monitor/shared/utils';
import { API_ENDPOINTS } from '@monitor/shared/constants';
import { PerformanceMonitor } from './performance';
import { PluginManager } from '../plugins';
import { RetryManager } from './retry';
import { EnhancedSourceMapParser } from './sourcemap';
import { SourceMapUploader } from './source-uploader';

type QueuedError = ErrorInfo & { id: string };

export interface MonitorConfig {
  projectId: string;
  reportUrl: string;
  maxErrors?: number;
  sampleRate?: number;
  plugins?: PluginManager;
  enableCompression?: boolean;
  enableRetry?: boolean;
  version?: string; // 项目版本号
  autoReport?: boolean; // 是否在捕获错误后自动上报，默认 true
}
export class Monitor {
  /**
   * 配置对象，包含监控实例的所有配置选项
   */
  private config: MonitorConfig;

  /**
   * 错误队列，存储待上报的错误信息
   */
  private errorQueue: QueuedError[] = [];

  /**
   * 用户行为队列，存储待上报的用户交互行为
   */
  private actionQueue: UserAction[] = [];

  /**
   * 性能指标数据
   */
  private performanceMetrics?: PerformanceMetrics;

  /**
   * 性能监控实例
   */
  private performanceMonitor?: PerformanceMonitor;

  /**
   * 重试管理器实例
   */
  private retryManager: RetryManager;

  /**
   * SourceMap 解析器实例
   */
  private sourceMapParser: EnhancedSourceMapParser;

  /**
   * SourceMap 上传器实例
   */
  private sourceMapUploader: SourceMapUploader;

  /**
   * 已上传的 SourceMap 文件信息数组
   * 存储格式包含文件名、URL和版本号
   */
  private sourceMaps: Array<{ filename: string; content: string; version?: string }> = [];

  /**
   * Monitor 类构造函数
   * @param config 监控配置对象
   */
  constructor(config: MonitorConfig) {
    // 合并默认配置和用户配置
    this.config = {
      maxErrors: 10, //错误队列最大长度
      sampleRate: 1, //采样率，默认100%
      enableCompression: false, //是否启用压缩，默认不启用
      enableRetry: true, //是否启用重试，默认启用
      autoReport: true, //是否自动上报，默认启用
      ...config,
    };
    // 初始化重试管理器
    this.retryManager = new RetryManager();
    // 初始化 SourceMap 解析器
    this.sourceMapParser = new EnhancedSourceMapParser();
    // 初始化 SourceMap 上传器，设置上报 URL、项目 ID 和版本号
    this.sourceMapUploader = new SourceMapUploader(
      this.config.reportUrl,
      this.config.projectId,
      this.config.version
    );
    // 执行初始化方法
    this.init();
  }

  /**
   * 初始化监控实例，顺序启动错误捕获、性能监控、行为追踪以及插件
   */
  private init() {
    //初始化错误
    this.setupErrorHandlers();
    //初始化性能监控
    this.setupPerformanceMonitor();
    //初始化行为追踪
    this.setupActionTracking();
    // 安装插件
    this.config.plugins?.install(this);
  }

  /**
   * 配置全局错误与 Promise 拒绝监听，将异常入队等待上报
   */
  private setupErrorHandlers() {
    window.addEventListener(
      'error',
      (event) => {
        if (event.target !== window) {
          //资源加载问题
          const target = event.target as HTMLElement;
          const errorInfo: ErrorInfo = {
            message: `Resource failed to load: ${target.tagName}`,
            stack: (target as any).src || (target as any).href,
            type: 'resource',
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            version: this.config.version, // 添加版本号
          };
          this.addError(errorInfo);
        } else {
          //js代码执行问题
          const errorInfo: ErrorInfo = {
            message: event.message,
            stack: event.error?.stack,
            type: 'js',
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            version: this.config.version, // 添加版本号
          };
          this.addError(errorInfo);
        }
      },
      true
    );
    //监听未处理的promise拒绝事件
    window.addEventListener('unhandledrejection', (event) => {
      const errorInfo: ErrorInfo = {
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack || '', //promise拒绝时的栈信息
        type: 'promise',
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        version: this.config.version, // 添加版本号
      };
      this.addError(errorInfo);
    });
  }

  /**
   * 初始化性能监控器并在完成指标收集后触发自动上报
   */
  private setupPerformanceMonitor() {
    this.performanceMonitor = new PerformanceMonitor((metrics) => {
      this.performanceMetrics = metrics;
        this.report();
    });
  }

  /**
   * 追踪用户交互行为，目前监听点击事件写入队列
   */
  private setupActionTracking() {
    // 使用捕获阶段，确保在按钮的 click handler 之前记录行为
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const action: UserAction = {
        type: 'click',
        target: target.tagName,
        timestamp: Date.now(),
      };
      //点击事件写入队列
      this.actionQueue.push(action);
    }, true);
  }

  /**
   * 将错误加入队列，按采样率与容量控制，同时尝试执行 SourceMap 映射
   */
  private addError(error: ErrorInfo) {
    const sampleRate = Math.min(Math.max(this.config.sampleRate ?? 1, 0), 1);
    if (Math.random() > sampleRate) {
      return;
    }

    const normalized: QueuedError = {
      ...error,
      id: generateId(),
      timestamp: error.timestamp || Date.now(),
      url: error.url || window.location.href,
      userAgent: error.userAgent || navigator.userAgent,
      version: error.version ?? this.config.version,
    };

    // 先同步将错误添加到队列，确保错误不会丢失
    const maxErrors = this.config.maxErrors ?? 10;
    if (this.errorQueue.length >= maxErrors) {
      this.errorQueue.shift();
    }
    this.errorQueue.push(normalized);

    // 异步进行 SourceMap 解析，解析完成后更新队列中的错误
    const processError = async () => {
      try {
        const parsed = await this.sourceMapParser.parseStackTrace(
          normalized,
          this.sourceMaps.length > 0 ? this.sourceMaps : undefined
        );
        // 找到队列中的错误并更新（如果还在队列中）
        const index = this.errorQueue.findIndex(e => e.id === normalized.id);
        if (index !== -1) {
          this.errorQueue[index] = { ...parsed, id: normalized.id };
        }
      } catch (err) {
        console.error('Failed to parse error stack trace:', err);
        // 错误已经在队列中，无需额外处理
      }
    };

    // 异步执行，不阻塞
    void processError();

    // 如果启用自动上报，则在错误添加后自动上报
    if (this.config.autoReport) {
      // 使用 setTimeout 确保在当前事件循环结束后上报，避免阻塞
      setTimeout(() => {
        this.report();
      }, 0);
    }
  }

  /**
   * 手动捕获并上报错误
   * @param error Error 对象或 ErrorInfo 对象
   */
  public captureError(error: Error | ErrorInfo) {
    if (error instanceof Error) {
      const errorInfo: ErrorInfo = {
        message: error.message,
        stack: error.stack,
        type: 'js',
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        version: this.config.version,
      };
      this.addError(errorInfo);
    } else {
      this.addError(error);
    }
  }

  /**
   * 上传 SourceMap 文件
   * @param file SourceMap 文件对象或文件路径
   * @param filename 文件名
   * @param version 版本号（可选）
   */
  public async uploadSourceMap(
    file: File | string,
    filename: string,
    version?: string
  ): Promise<void> {
    try {
      //返回处理过后的sourceMap 文件信息 通过base64编码的content
      const sourceMapInfo = await this.sourceMapUploader.uploadSourceMap(file, filename, version);
      this.sourceMaps.push(sourceMapInfo);
      console.log(`Successfully uploaded SourceMap: ${filename}`);
    } catch (error) {
      console.error('Failed to upload SourceMap:', error);
      throw error;
    }
  }

  /**
   * 批量上传 SourceMap 文件
   * @param files SourceMap 文件对象数组或文件路径数组
   * @param filenames 对应的文件名数组
   * @param version 版本号（可选）
   */
  public async uploadSourceMaps(
    files: (File | string)[],
    filenames: string[],
    version?: string
  ): Promise<void> {
    try {
      const sourceMapInfos = await this.sourceMapUploader.uploadSourceMaps(
        files,
        filenames,
        version
      );
      this.sourceMaps.push(...sourceMapInfos);
      console.log(`Successfully uploaded ${sourceMapInfos.length} SourceMaps`);
    } catch (error) {
      console.error('Failed to upload SourceMaps:', error);
      throw error;
    }
  }

  /**
   * 汇总错误、性能与行为数据并发送到服务端
   */
  public async report() {
    // 检查是否有任何数据需要上报
    if (this.errorQueue.length === 0 && !this.performanceMetrics && this.actionQueue.length === 0) return;

    // 复制当前队列数据，避免发送过程中被修改
    const errors = [...this.errorQueue];
    const actions = [...this.actionQueue];
    const performance = this.performanceMetrics;

    // 立即清空队列，允许新数据继续收集
    this.errorQueue = [];
    this.actionQueue = [];
    this.performanceMetrics = undefined;

    const data: ReportData = {
      projectId: this.config.projectId,
      errors: errors.length > 0 ? errors : undefined,
      performance: performance,
      actions: actions.length > 0 ? actions : undefined,
    };
    const url = `${this.config.reportUrl}/api/report`;
    const payload = JSON.stringify(data);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

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
    } catch (error) {
      console.error('Failed to send report after retries:', error);
      // 上报失败时，将数据放回队列
      this.errorQueue.unshift(...errors);
      this.actionQueue.unshift(...actions);
      if (performance) {
        this.performanceMetrics = performance;
      }
    }
  }
}

export default Monitor;
