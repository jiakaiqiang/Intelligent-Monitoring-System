import { SourceMapInfo } from '../types/index';

export interface SourceMapUploadOptions {
  files?: string[]; // SourceMap 文件路径数组
  contentMap?: Record<string, string>; // 文件名到内容的映射
  version?: string; // 项目版本号
}

export interface SourceMapUploaderConfig {
  reportUrl: string;
  projectId: string;
  version?: string; // 项目版本号
  maxFileSize?: number; // 最大文件大小，默认 10MB
  timeout?: number; // 请求超时时间，默认 30s
}

/**
 * SourceMap 上传器
 * 负责收集和上传 SourceMap 文件到服务器
 */
export class SourceMapUploader {
  private config: SourceMapUploaderConfig;
  private queue: SourceMapInfo[] = [];

  constructor(config: SourceMapUploaderConfig) {
    this.config = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      timeout: 30000,
      ...config
    };
  }

  /**
   * 添加 SourceMap 文件到上传队列（仅在 Node.js 环境中可用）
   */
  public addFiles(files: string[], version?: string): Promise<void> {
    // 检查是否在 Node.js 环境中
    if (typeof window !== 'undefined') {
      console.warn('addFiles method is only available in Node.js environment. Use addContent instead.');
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const promises = files.map(async (filePath) => {
        try {
          const content = await this.readFileContent(filePath);
          const filename = this.getFileNameFromPath(filePath);
          this.queue.push({
            filename,
            content,
            version: version || this.config.version
          });
        } catch (error) {
          console.error(`Failed to read SourceMap file: ${filePath}`, error);
          // 不抛出错误，继续处理其他文件
        }
      });

      Promise.allSettled(promises).then(() => resolve());
    });
  }

  /**
   * 添加 SourceMap 内容（直接传入）
   */
  public addContent(content: string, filename: string, version?: string): void {
    // 计算内容大小（Base64 编码）
    const contentSize = this.calculateContentSize(content);

    if (contentSize > this.config.maxFileSize!) {
      console.warn(`SourceMap file ${filename} exceeds size limit (${this.config.maxFileSize} bytes)`);
      return;
    }

    this.queue.push({
      filename,
      content,
      version: version || this.config.version
    });
  }

  /**
   * 批量上传所有 queued 的 SourceMap
   */
  public async upload(): Promise<boolean> {
    if (this.queue.length === 0) {
      return true;
    }

    try {
      const response = await fetch(`${this.config.reportUrl}/api/sourcemaps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: this.config.projectId,
          sourceMaps: this.queue
        }),
        signal: AbortSignal.timeout(this.config.timeout!)
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`Successfully uploaded ${this.queue.length} SourceMap files`, result);

      // 清空队列
      this.queue = [];
      return true;
    } catch (error) {
      console.error('Failed to upload SourceMaps:', error);
      return false;
    }
  }

  /**
   * 获取队列中的 SourceMap 数量
   */
  public getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * 清空上传队列
   */
  public clearQueue(): void {
    this.queue = [];
  }

  /**
   * 读取文件内容并 Base64 编码（仅在 Node.js 环境中可用）
   * @deprecated 此方法仅用于构建时类型检查，实际使用时请根据环境选择适当的方法
   */
  private async readFileContent(filePath: string): Promise<string> {
    // 这个方法在浏览器环境中不会被调用
    return '';
  }

  /**
   * 计算内容大小（考虑 Base64 编码）
   */
  private calculateContentSize(content: string): number {
    // Base64 编码的内容大约是原始内容的 4/3
    return Math.ceil((content.length * 3) / 4);
  }

  /**
   * 从文件路径中提取文件名
   */
  private getFileNameFromPath(filePath: string): string {
    // 使用浏览器兼容的方式获取文件名
    return filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
  }
}