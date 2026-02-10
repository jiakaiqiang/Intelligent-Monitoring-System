import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsArray, IsBoolean, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 数据传输对象(DTO)定义
 *
 * DTO分为三部分：
 * 1. CreateSourceMapDto —— 接收SDK上传的数据，包含项目信息与base64内容。
 * 2. Query/Pagination DTO —— 控制列表查询参数。
 * 3. Response DTO —— 用于Swagger文档和类型提示，保障接口契约清晰。
 */

/**
 * 创建SourceMap的数据传输对象
 * 用于接收客户端上传的SourceMap文件信息
 */
export class CreateSourceMapDto {
  @ApiProperty({ description: 'Project name', example: 'my-project' })
  @IsString()
  project: string;

  @ApiProperty({ description: 'Project version', example: '1.0.0' })
  @IsString()
  version: string;

  @ApiProperty({ description: 'Source map filename', example: 'app.js.map' })
  @IsString()
  filename: string;

  @ApiProperty({
    description: 'Source map file content (base64 encoded)',
    example: 'eyJzdHJpbmdzIjpbXX0=',
  })
  @IsString()
  sourcemap: string;

  @ApiProperty({ description: 'Application name', example: 'web-app', required: false })
  @IsString()
  @IsOptional()
  app?: string;

  @ApiProperty({ description: 'Environment', example: 'production', required: false })
  @IsString()
  @IsOptional()
  environment?: string;

  @ApiProperty({ description: 'Build timestamp', example: 1640995200000, required: false })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  buildTimestamp?: number;

  @ApiProperty({
    description: 'Source map metadata (JSON object)',
    example: { compiler: 'webpack', sourceMapVersion: 3 },
    required: false,
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Associated source files (base64 encoded)',
    example: ['file1.js', 'file2.js'],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  sources?: string[];
}

/**
 * 查询SourceMap的数据传输对象
 * 用于过滤和搜索SourceMap记录
 */
export class QuerySourceMapDto {
  @ApiProperty({ description: 'Project name', required: false })
  @IsString()
  @IsOptional()
  project?: string;

  @ApiProperty({ description: 'Project version', required: false })
  @IsString()
  @IsOptional()
  version?: string;

  @ApiProperty({ description: 'Application name', required: false })
  @IsString()
  @IsOptional()
  app?: string;

  @ApiProperty({ description: 'Environment', required: false })
  @IsString()
  @IsOptional()
  environment?: string;

  @ApiProperty({ description: 'Whether to include deleted files', example: false, required: false })
  @IsBoolean()
  @IsOptional()
  includeDeleted?: boolean;
}

/**
 * 项目版本查询的数据传输对象
 * 用于精确查找特定项目和版本的SourceMap
 */
export class ProjectVersionQueryDto {
  @ApiProperty({ description: 'Project name', example: 'my-project', required: false })
  @IsString()
  @IsOptional()
  project?: string;

  @ApiProperty({ description: 'Project version', example: '1.0.0', required: false })
  @IsString()
  @IsOptional()
  version?: string;

  @ApiProperty({ description: 'Application name', example: 'web-app', required: false })
  @IsString()
  @IsOptional()
  app?: string;

  @ApiProperty({ description: 'Environment', example: 'production', required: false })
  @IsString()
  @IsOptional()
  environment?: string;
}

/**
 * 分页查询的数据传输对象
 * 用于控制分页查询的参数
 */
export class PaginationQueryDto {
  @ApiProperty({ description: 'Page number', example: 1, default: 1 })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', example: 10, default: 10, maximum: 100 })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 10;

  @ApiProperty({ description: 'Sort field', example: 'createdAt', required: false })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiProperty({ description: 'Sort direction (asc or desc)', example: 'desc', required: false })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

/**
 * SourceMap响应数据传输对象
 * 用于返回SourceMap详细信息
 */
export class SourceMapResponseDto {
  @ApiProperty({ description: 'Source map ID' })
  id: string;

  @ApiProperty({ description: 'Project name' })
  project: string;

  @ApiProperty({ description: 'Project version' })
  version: string;

  @ApiProperty({ description: 'Application name' })
  app?: string;

  @ApiProperty({ description: 'Environment' })
  environment?: string;

  @ApiProperty({ description: 'Source map content (base64 encoded)' })
  sourcemap: string;

  @ApiProperty({ description: 'Build timestamp' })
  buildTimestamp?: number;

  @ApiProperty({ description: 'Source map metadata' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Associated source files' })
  sources?: string[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({ description: 'Whether the source map is marked as deleted' })
  isDeleted: boolean;

  @ApiProperty({ description: 'Deletion timestamp if marked as deleted' })
  deletedAt?: Date;
}

/**
 * 分页响应数据传输对象
 * 用于封装分页查询的结果
 * @template T 数据项类型
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Data array' })
  data: T[];

  @ApiProperty({ description: 'Total number of items' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Whether there are more items' })
  hasNext: boolean;

  @ApiProperty({ description: 'Whether there are previous items' })
  hasPrev: boolean;
}

/**
 * 上传响应数据传输对象
 * 用于返回SourceMap上传操作的结果
 */
export class UploadResponseDto {
  @ApiProperty({ description: 'Upload success message' })
  message: string;

  @ApiProperty({ description: 'Created source map ID' })
  id: string;

  @ApiProperty({ description: 'Project name' })
  project: string;

  @ApiProperty({ description: 'Project version' })
  version: string;

  @ApiProperty({ description: 'Application name' })
  app?: string;

  @ApiProperty({ description: 'Environment' })
  environment?: string;

  @ApiProperty({ description: 'Upload timestamp' })
  timestamp: Date;
}
