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
  Headers,
  Res,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { SourceMapService } from './sourcemap.service';
import { SourceMapInfo } from '../schemas/sourcemap.schema';
import {
  CreateSourceMapDto,
  QuerySourceMapDto,
  ProjectVersionQueryDto,
  PaginationQueryDto,
  SourceMapResponseDto,
  PaginatedResponseDto,
  UploadResponseDto,
} from './dto/sourcemap.dto';
import { AdvancedQueryDto, BulkOperationDto, SortOrder } from './dto/sourcemap.advanced.dto';

@Controller('api/sourcemaps')
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
  @UsePipes(new ValidationPipe({ transform: true }))
  async upload(@Body() body: CreateSourceMapDto) {
    try {
      const sourceMapPayload: SourceMapInfo = {
        filename: body.filename,
        content: body.sourcemap,
        version: body.version,
      };

      const documents = await this.sourceMapService.create(body.project, [sourceMapPayload]);
      this.logger.log(`Successfully uploaded SourceMap file for project ${body.project}`);

      return {
        success: true,
        message: `Successfully uploaded SourceMap file`,
        data: {
          id: documents[0].id,
          filename: documents[0].filename,
          version: documents[0].version,
          uploadedAt: documents[0].uploadedAt,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to upload SourceMap for project ${body.project}: ${error.message}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to upload SourceMap: ' + error.message);
    }
  }

  /**
   * Get SourceMaps by project ID (with optional version filtering)
   */
  @Get(':projectId')
  async getByProject(
    @Param('projectId') projectId: string,
    @Query() query: ProjectVersionQueryDto
  ) {
    try {
      const { version } = query;
      const page = query['page'] || 1;
      const limit = query['limit'] || 10;
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
        throw new NotFoundException(
          `No SourceMap found for project ${projectId}${version ? ` version ${version}` : ''}`
        );
      }

      return {
        success: true,
        data: result.data.map((doc) => ({
          id: doc.id,
          filename: doc.filename,
          version: doc.version,
          uploadedAt: doc.uploadedAt,
          expiresAt: doc.expiresAt,
        })),
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: result.totalPages,
        },
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
  async getByFile(
    @Param('projectId') projectId: string,
    @Param('filename') filename: string,
    @Query('version') version?: string
  ) {
    if (!projectId || !filename) {
      throw new BadRequestException('Project ID and filename are required');
    }

    try {
      const startTime = Date.now();
      const sourceMap = await this.sourceMapService.findOne({
        projectId,
        version,
        filename,
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
          expiresAt: sourceMap.expiresAt,
        },
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
        throw new NotFoundException(
          `No SourceMap found for project ${projectId} version ${version}`
        );
      }

      return {
        success: true,
        data: sourceMaps.map((doc) => ({
          id: doc.id,
          filename: doc.filename,
          version: doc.version,
          uploadedAt: doc.uploadedAt,
          expiresAt: doc.expiresAt,
        })),
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
  @HttpCode(HttpStatus.NO_CONTENT)
  async cleanupExpired() {
    const deletedCount = await this.sourceMapService.cleanupExpired();
    this.logger.log(`Cleaned up ${deletedCount} expired SourceMap files`);
    return {
      success: true,
      message: `Cleaned up ${deletedCount} expired SourceMap files`,
    };
  }

  /**
   * Advanced search with filters and sorting
   */
  @Get('search')
  async advancedSearch(@Query() query: AdvancedQueryDto & PaginationQueryDto) {
    const {
      search,
      sortBy = 'uploadedAt',
      sortOrder = SortOrder.DESC,
      includeContent,
      page = 1,
      limit = 10,
    } = query;
    const expirationStatus = query['expirationStatus'];

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
      const total = await this.sourceMapService
        .findByProjectAndVersion('', '', page, limit)
        .then((result) => result.total)
        .catch(() => 0);
      const totalPages = Math.ceil(total / limit);

      const sort: any = {};
      sort[sortBy] = sortOrder === SortOrder.ASC ? 1 : -1;

      const data = await this.sourceMapService
        .findByProjectAndVersion('', '', page, limit)
        .then((result) => result.data)
        .catch(() => []);

      return {
        success: true,
        data: data.map((doc) => ({
          id: doc.id,
          filename: doc.filename,
          version: doc.version,
          uploadedAt: doc.uploadedAt,
          expiresAt: doc.expiresAt,
          ...(includeContent && { content: doc.content }),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      throw new BadRequestException('Failed to search SourceMaps: ' + error.message);
    }
  }

  /**
   * Get distinct versions for a project
   */
  @Get(':projectId/versions')
  async getProjectVersions(@Param('projectId') projectId: string) {
    try {
      const versions = await this.sourceMapService.getProjectVersions(projectId);

      return {
        success: true,
        data: versions,
        count: versions.length,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch versions: ' + error.message);
    }
  }

  /**
   * Bulk operations
   */
  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  async bulkOperations(@Body() bulkDto: BulkOperationDto) {
    try {
      if (bulkDto.operation === 'delete') {
        const result = await this.sourceMapService.bulkDelete(bulkDto.ids);
        return {
          success: true,
          message: `Deleted ${result} SourceMaps`,
          deletedCount: result,
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
  async health(@Headers('X-Request-ID') requestId?: string) {
    const startTime = Date.now();
    const healthResult = await this.sourceMapService.getHealth();
    const healthTime = Date.now() - startTime;

    return {
      success: true,
      message: 'SourceMap service is running',
      timestamp: new Date().toISOString(),
      requestId,
      health: {
        status: healthResult.status,
        responseTime: healthTime,
        collectionInfo: healthResult.collectionInfo,
      },
    };
  }
}
