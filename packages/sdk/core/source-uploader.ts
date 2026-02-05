import { SourceMapInfo } from '@monitor/shared/types';

/**
 * SourceMap 上传器
 * 负责读取 SourceMap 文件并上传到服务端
 */
export class SourceMapUploader {
  private reportUrl: string;
  private projectId: string;
  private version?: string;

  constructor(reportUrl: string, projectId: string, version?: string) {
    this.reportUrl = reportUrl;
    this.projectId = projectId;
    this.version = version;
  }

  /**
   * 读取 SourceMap 文件并转换为 Base64
   * @param file SourceMap 文件对象
   * @returns Base64 编码的文件内容
   */
  private async readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // 移除 data URL 前缀，只保留 Base64 内容
        const base64Content = result.split(',')[1] || result;
        resolve(base64Content);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * 读取 SourceMap 文件内容（从路径）
   * @param filePath SourceMap 文件路径
   * @returns Base64 编码的文件内容
   */
  private async readFilePathAsBase64(filePath: string): Promise<string> {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // 移除 data URL 前缀，只保留 Base64 内容
          const base64Content = result.split(',')[1] || result;
          resolve(base64Content);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Failed to read file:', error);
      throw error;
    }
  }

  /**
   * 上传单个 SourceMap 文件
   * @param file SourceMap 文件对象或文件路径
   * @param filename 文件名
   * @param version 版本号（可选，如果不提供则使用构造函数中的版本号）
   */
  public async uploadSourceMap(file: File | string, filename: string, version?: string): Promise<SourceMapInfo> {
    let content: string;

    if (typeof file === 'string') {
      // 文件路径
      content = await this.readFilePathAsBase64(file);
    } else {
      // File 对象
      content = await this.readFileAsBase64(file);
    }

    const sourceMapInfo: SourceMapInfo = {
      filename,
      content,
      version: version || this.version
    };

    // 上传到服务端
    await this.uploadToServer(sourceMapInfo);

    return sourceMapInfo;
  }

  /**
   * 批量上传 SourceMap 文件
   * @param files SourceMap 文件对象数组或文件路径数组
   * @param filenames 对应的文件名数组
   * @param version 版本号（可选）
   */
  public async uploadSourceMaps(files: (File | string)[], filenames: string[], version?: string): Promise<SourceMapInfo[]> {
    const uploadPromises = files.map((file, index) =>
      this.uploadSourceMap(file, filenames[index], version)
    );

    return Promise.all(uploadPromises);
  }

  /**
   * 上传 SourceMap 到服务端
   * @param sourceMapInfo SourceMap 信息
   */
  private async uploadToServer(sourceMapInfo: SourceMapInfo): Promise<void> {
    const url = `${this.reportUrl}/api/sourcemaps`;

    const payload = {
      projectId: this.projectId,
      sourceMap: sourceMapInfo
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      console.log(`Successfully uploaded SourceMap: ${sourceMapInfo.filename}`);
    } catch (error) {
      console.error('Failed to upload SourceMap:', error);
      throw error;
    }
  }
}