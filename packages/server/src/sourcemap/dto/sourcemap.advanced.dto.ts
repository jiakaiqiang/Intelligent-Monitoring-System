import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsBoolean, IsObject, IsEnum, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from './sourcemap.dto';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

export class AdvancedQueryDto extends PaginationQueryDto {
  @ApiProperty({ description: 'Search term across multiple fields', example: 'project-name', required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ description: 'Fields to search in (comma-separated)', example: 'project,version,metadata.deploymentUrl', required: false })
  @IsString()
  @IsOptional()
  searchFields?: string;

  @ApiProperty({ description: 'Date range (beginning timestamp)', example: 1640995200000, required: false })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  dateFrom?: number;

  @ApiProperty({ description: 'Date range (ending timestamp)', example: 1641081600000, required: false })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  dateTo?: number;

  @ApiProperty({ description: 'Metadata filters (JSON string)', example: '{"compiler": "webpack", "sourceMapVersion": 3}', required: false })
  @IsObject()
  @IsOptional()
  metadataFilters?: Record<string, any>;

  @ApiProperty({ description: 'Array of file extensions to filter', example: ['.js', '.ts'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  extensions?: string[];

  @ApiProperty({ description: 'Minimum file size in bytes', example: 1024, required: false })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  minSize?: number;

  @ApiProperty({ description: 'Maximum file size in bytes', example: 1048576, required: false })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  maxSize?: number;

  @ApiProperty({ description: 'Whether to include source map content in response', example: false, required: false })
  @IsBoolean()
  @IsOptional()
  includeContent?: boolean = false;

  @ApiProperty({ description: 'Whether to include only active (non-deleted) source maps', example: true, required: false })
  @IsBoolean()
  @IsOptional()
  activeOnly?: boolean = true;

  @ApiProperty({ description: 'Filter by specific deployment URLs in metadata', example: ['https://example.com'], required: false })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  deploymentUrls?: string[];
}

export class BulkOperationDto {
  @ApiProperty({ description: 'Array of source map IDs to operate on', example: ['id1', 'id2', 'id3'] })
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  ids: string[];

  @ApiProperty({ description: 'Operation type', enum: ['delete', 'undelete', 'archive', 'restore'] })
  @IsEnum(['delete', 'undelete', 'archive', 'restore'])
  operation: 'delete' | 'undelete' | 'archive' | 'restore';

  @ApiProperty({ description: 'Additional parameters for the operation', example: { force: false, recursive: false }, required: false })
  @IsObject()
  @IsOptional()
  params?: Record<string, any>;

  @ApiProperty({ description: 'Whether to process all items even if some fail', example: false, required: false })
  @IsBoolean()
  @IsOptional()
  continueOnError?: boolean = false;

  @ApiProperty({ description: 'Comment for the bulk operation', example: 'Cleaning up old source maps', required: false })
  @IsString()
  @IsOptional()
  comment?: string;
}