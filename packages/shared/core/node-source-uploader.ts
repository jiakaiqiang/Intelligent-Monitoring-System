/**
 * 在构建时使用的 Node.js SourceMap 上传器类型
 * 注意：这个类仅在 TypeScript 类型检查时使用
 */
export interface NodeSourceMapUploader {
  addFiles(files: string[], version?: string): Promise<void>;
}