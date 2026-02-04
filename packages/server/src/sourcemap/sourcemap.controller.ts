import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Delete,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Query,
  UsePipes,
  ValidationPipe,
  UseInterceptors,
  CacheInterceptor,
  CacheTTL,
  Headers,
  Res,
  Logger
} from '@nestjs/common';
import { Response } from 'express';
import { SourceMapService } from './sourcemap.service';
import { SourceMapInfo } from '../schemas/sourcemap.schema';
import { SourceMapModel } from '../schemas/sourcemap.schema';
import {
  CreateSourceMapDto,
  QuerySourceMapDto,
  ProjectVersionQueryDto,
  PaginationQueryDto,
  SourceMapResponseDto,
  PaginatedResponseDto,
  UploadResponseDto
} from './dto/sourcemap.dto';
import { AdvancedQueryDto, BulkOperationDto, SortOrder } from './dto/sourcemap.advanced.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiHeader } from '@nestjs/swagger';

@ApiTags('SourceMaps')
@Controller('api/sourcemaps')
@UseInterceptors(CacheInterceptor)
export class SourceMapController {
  private readonly logger = new Logger(SourceMapController.name);
  private readonly ONE_HOUR_SECONDS = 60 * 60;
  private readonly ONE_DAY_SECONDS = 24 * 60 * 60;
  private readonly ONE_WEEK_SECONDS = 7 * 24 * 60 * 60;

  constructor(private readonly sourceMapService: SourceMapService) {}

  /**
   * Upload SourceMap files
   */
  @Post()
  @ApiOperation({ summary: 'Upload SourceMap files' })
  @ApiResponse({ status: 200, description: 'SourceMap files uploaded successfully', type: UploadResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @UsePipes(new ValidationPipe({ transform: true }))
  async upload(@Body() body: CreateSourceMapDto, @Res({ passthrough: true }) response: Response) {
    // Set caching headers for upload endpoint
    response.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.set('Pragma', 'no-cache');
    response.set('Expires', '0');

    try {
      const documents = await this.sourceMapService.create(body.projectId, body.sourceMaps);
      this.logger.log(`Successfully uploaded ${documents.length} SourceMap files for project ${body.projectId}`);

      return {
        success: true,
        message: `Successfully uploaded ${documents.length} SourceMap files`,
        data: documents.map(doc => ({
          id: doc.id,
          filename: doc.filename,
          version: doc.version,
          uploadedAt: doc.uploadedAt
        }))
      };
    } catch (error) {
      this.logger.error(`Failed to upload SourceMaps for project ${body.projectId}: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to upload SourceMaps: ' + error.message);
    }
  }

  /**
   * Get SourceMaps by project ID (with optional version filtering)
   */
  @Get(':projectId')
  @ApiOperation({ summary: 'Get SourceMaps by project ID (with optional version filtering)' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'version', description: 'Version filter (optional)', required: false })
  @ApiQuery({ name: 'page', description: 'Page number', required: false })
  @ApiQuery({ name: 'limit', description: 'Items per page', required: false })
  @CacheTTL(300)
  async getByProject(
    @Param('projectId') projectId: string,
    @Query() query: ProjectVersionQueryDto,
    @Res({ passthrough: true }) response: Response
  ) {
    // Set caching headers for GET requests
    response.set('Cache-Control', `public, max-age=${this.ONE_HOUR_SECONDS}, stale-while-revalidate=${this.ONE_DAY_SECONDS}`);
    response.set('ETag', `"${projectId}-${query.version || 'latest'}-${query.page || 1}"`);

    try {
      const { version, page = 1, limit = 10 } = query;
      const startTime = Date.now();

      const result = await this.sourceMapService.findByProjectAndVersion(
        projectId,
        version,
        page,
        limit
      );

      const queryTime = Date.now() - startTime;
      this.logger.debug(`Query for project ${projectId} took ${queryTime}ms`);

      if (result.data.length === 0) {
        throw new NotFoundException(`No SourceMap found for project ${projectId}${version ? ` version ${version}` : ''}`);
      }

      return {
        success: true,
        data: result.data.map(doc => ({
          id: doc.id,
          filename: doc.filename,
          version: doc.version,
          uploadedAt: doc.uploadedAt,
          expiresAt: doc.expiresAt
        })),
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: result.totalPages
        }
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch SourceMaps: ' + error.message);
    }
  }

  /**
   * Get specific SourceMap by filename
   */
  @Get(':projectId/:filename')
  @ApiOperation({ summary: 'Get specific SourceMap by filename' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'filename', description: 'SourceMap filename' })
  @ApiQuery({ name: 'version', description: 'Version filter (optional)', required: false })
  @CacheTTL(600)
  async getByFile(
    @Param('projectId') projectId: string,
    @Param('filename') filename: string,
    @Query('version') version?: string,
    @Res({ passthrough: true }) response: Response
  ) {
    // Set aggressive caching for frequently accessed SourceMaps
    response.set('Cache-Control', `public, max-age=${this.ONE_WEEK_SECONDS}, immutable`);
    response.set('ETag', `"${projectId}-${filename}-${version || 'latest'}"`);

    if (!projectId || !filename) {
      throw new BadRequestException('Project ID and filename are required');
    }

    try {
      const startTime = Date.now();
      const sourceMap = await this.sourceMapService.findOne({
        projectId,
        version,
        filename
      });

      const queryTime = Date.now() - startTime;
      this.logger.debug(`SourceMap lookup for ${filename} took ${queryTime}ms`);

      if (!sourceMap) {
        throw new NotFoundException(`SourceMap not found: ${filename}`);
      }

      return {
        success: true,
        data: {
          id: sourceMap.id,
          filename: sourceMap.filename,
          version: sourceMap.version,
          uploadedAt: sourceMap.uploadedAt,
          expiresAt: sourceMap.expiresAt
        }
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch SourceMap: ' + error.message);
    }
  }

  /**
   * Query SourceMap by project and version (specific endpoint from task 8)
   */
  @Get(':projectId/:version')
  @ApiOperation({ summary: 'Get all SourceMaps for a specific project and version' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiParam({ name: 'version', description: 'Version number' })
  @CacheTTL(300)
  async getByProjectAndVersion(
    @Param('projectId') projectId: string,
    @Param('version') version: string
  ) {
    if (!projectId || !version) {
      throw new BadRequestException('Project ID and version are required');
    }

    try {
      const sourceMaps = await this.sourceMapService.getByProjectAndVersion(projectId, version);

      if (sourceMaps.length === 0) {
        throw new NotFoundException(`No SourceMap found for project ${projectId} version ${version}`);
      }

      return {
        success: true,
        data: sourceMaps.map(doc => ({
          id: doc.id,
          filename: doc.filename,
          version: doc.version,
          uploadedAt: doc.uploadedAt,
          expiresAt: doc.expiresAt
        }))
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch SourceMaps: ' + error.message);
    }
  }

  /**
   * Clean up expired SourceMaps (admin only)
   */
  @Delete('cleanup')
  @ApiOperation({ summary: 'Clean up expired SourceMaps (admin only)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async cleanupExpired(@Res({ passthrough: true }) response: Response) {
    // No caching for cleanup operation
    response.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.set('Pragma', 'no-cache');
    response.set('Expires', '0');

    const deletedCount = await this.sourceMapService.cleanupExpired();
    this.logger.log(`Cleaned up ${deletedCount} expired SourceMap files`);
    return {
      success: true,
      message: `Cleaned up ${deletedCount} expired SourceMap files`
    };
  }

  /**
   * Advanced search with filters and sorting
   */
  @Get('search')
  @ApiOperation({ summary: 'Advanced search for SourceMaps' })
  @ApiQuery({ name: 'page', description: 'Page number', required: false })
  @ApiQuery({ name: 'limit', description: 'Items per page', required: false })
  @ApiQuery({ name: 'search', description: 'Search term for filename', required: false })
  @ApiQuery({ name: 'sortBy', description: 'Sort field', enum: ['uploadedAt', 'version', 'filename', 'expiresAt'], required: false })
  @ApiQuery({ name: 'sortOrder', description: 'Sort order', enum: SortOrder, required: false })
  @ApiQuery({ name: 'expirationStatus', description: 'Filter by expiration status', enum: ['active', 'expired'], required: false })
  @ApiQuery({ name: 'includeContent', description: 'Include full content', default: false, required: false })
  @CacheTTL(60)
  async advancedSearch(
    @Query() query: AdvancedQueryDto & PaginationQueryDto
  ) {
    const { search, sortBy = 'uploadedAt', sortOrder = SortOrder.DESC, expirationStatus, includeContent, page = 1, limit = 10 } = query;

    try {
      const filter: any = {};

      // Search filter
      if (search) {
        filter.filename = { $regex: search, $options: 'i' };
      }

      // Expiration filter
      if (expirationStatus) {
        const now = new Date();
        if (expirationStatus === 'expired') {
          filter.expiresAt = { $lt: now };
        } else {
          filter.expiresAt = { $gte: now };
        }
      }

      const skip = (page - 1) * limit;
      const total = await this.sourceMapService.sourceMapModel.countDocuments(filter);
      const totalPages = Math.ceil(total / limit);

      const sort: any = {};
      sort[sortBy] = sortOrder === SortOrder.ASC ? 1 : -1;

      const data = await this.sourceMapModel
        .find(filter)
        .select(includeContent ? 'filename version uploadedAt expiresAt content' : 'filename version uploadedAt expiresAt')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec();

      return {
        success: true,
        data: data.map(doc => ({
          id: doc.id,
          filename: doc.filename,
          version: doc.version,
          uploadedAt: doc.uploadedAt,
          expiresAt: doc.expiresAt,
          ...(includeContent && { content: doc.content })
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      };
    } catch (error) {
      throw new BadRequestException('Failed to search SourceMaps: ' + error.message);
    }
  }

  /**
   * Get distinct versions for a project
   */
  @Get(':projectId/versions')
  @ApiOperation({ summary: 'Get all distinct versions for a project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @CacheTTL(600)
  async getProjectVersions(@Param('projectId') projectId: string) {
    if (!projectId) {
      throw new BadRequestException('Project ID is required');
    }

    try {
      const versions = await this.sourceMapService.sourceMapModel
        .distinct('version', { projectId })
        .sort();

      return {
        success: true,
        data: versions,
        count: versions.length
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch versions: ' + error.message);
    }
  }

  /**
   * Bulk operations
   */
  @Post('bulk')
  @ApiOperation({ summary: 'Perform bulk operations on SourceMaps' })
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  async bulkOperations(@Body() bulkDto: BulkOperationDto) {
    try {
      if (bulkDto.operation === 'delete') {
        const result = await this.sourceMapService.sourceMapModel.deleteMany({
          _id: { $in: bulkDto.ids }
        });
        return {
          success: true,
          message: `Deleted ${result.deletedCount} SourceMaps`,
          deletedCount: result.deletedCount
        };
      } else {
        throw new BadRequestException('Unsupported operation type');
      }
    } catch (error) {
      throw new BadRequestException('Bulk operation failed: ' + error.message);
    }
  }

  /**
   * Health check endpoint for SourceMap service
   */
  @Get('health')
  @ApiOperation({ summary: 'Health check for SourceMap service' })
  @ApiHeader({ name: 'X-Request-ID', required: false })
  async health(@Headers('X-Request-ID') requestId?: string, @Res({ passthrough: true }) response: Response) {
    // No caching for health endpoint
    response.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.set('Pragma', 'no-cache');
    response.set('Expires', '0');

    const startTime = Date.now();
    const healthResult = await this.sourceMapService.getHealth();
    const healthTime = Date.now() - startTime;

    response.set('X-Health-Response-Time', `${healthTime}ms`);

    return {
      success: true,
      message: 'SourceMap service is running',
      timestamp: new Date().toISOString(),
      requestId,
      health: {
        status: healthResult.status,
        responseTime: healthTime,
        collectionInfo: healthResult.collectionInfo
      }
    };
  }
}