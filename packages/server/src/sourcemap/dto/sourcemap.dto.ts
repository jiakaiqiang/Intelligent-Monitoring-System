import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsArray, IsBoolean, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO 分为三部分：
 * 1. CreateSourceMapDto —— 接收 SDK 上传的数据，包含项目信息与 base64 内容。
 * 2. Query/Pagination DTO —— 控制列表查询参数。
 * 3. Response DTO —— 用于 Swagger 文档和类型提示，保障接口契约清晰。
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
