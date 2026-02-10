import { ErrorInfo, PerformanceMetrics, UserAction, ReportData } from '@monitor/shared/types';
import { generateId, compress } from '@monitor/shared/utils';
import { API_ENDPOINTS } from '@monitor/shared/constants';
import { PerformanceMonitor } from './performance';
import { PluginManager } from '../plugins';
import { RetryManager } from './retry';
import { EnhancedSourceMapParser } from './sourcemap';
import { SourceMapUploader } from './source-uploader';

export interface MonitorConfig {
  projectId: string;
  reportUrl: string;
  maxErrors?: number;
  sampleRate?: number;
  plugins?: PluginManager;
  enableCompression?: boolean;
  enableRetry?: boolean;
  version?: string; // 项目版本号
}
export class Monitor {
  /**
   * 配置对象，包含监控实例的所有配置选项
   */
  private config: MonitorConfig;

  /**
   * 错误队列，存储待上报的错误信息
   */
  private errorQueue: ErrorInfo[] = [];

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
      maxErrors: 10,//错误队列最大长度
      sampleRate: 1,//采样率，默认100%
      enableCompression: false,//是否启用压缩，默认不启用
      enableRetry: true,//是否启用重试，默认启用
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
        stack: event.reason?.stack || '',//promise拒绝时的栈信息
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
      //性能采集完进行上报
      this.report();
    });
  }

  /**
   * 追踪用户交互行为，目前监听点击事件写入队列
   */
  private setupActionTracking() {
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const action: UserAction = {
        type: 'click',
        target: target.tagName,
        timestamp: Date.now(),
      };
      //点击事件写入队列
      this.actionQueue.push(action);
    });
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
    if (this.errorQueue.length === 0 && !this.performanceMetrics) return;

    const data: ReportData = {
      projectId: this.config.projectId,
      errors: this.errorQueue.length > 0 ? this.errorQueue : undefined,
      performance: this.performanceMetrics,
      actions: this.actionQueue.length > 0 ? this.actionQueue : undefined,
    };
    console.log(data, 'data');
    const url = `${this.config.reportUrl}/api/jkq`;
    const payload = this.config.enableCompression ? compress(data) : JSON.stringify(data);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // if (this.config.enableCompression) {
    //   headers['Content-Encoding'] = 'base64';
    // }
    console.log(url, 'urlurlurlurlurlurlurlurlurlurl', payload);
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
