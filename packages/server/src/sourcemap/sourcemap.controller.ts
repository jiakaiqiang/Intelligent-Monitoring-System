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
import { SourceMapInfo } from './entities/sourcemap.entity';
import { SourceMapEntity } from './entities/sourcemap.entity';
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
   * 上传 SourceMap：
   * - 校验 DTO（ValidationPipe）后，将请求体映射为内部 SourceMapInfo 结构。
   * - 调用 service.create 统一处理版本去重及存储。
   * - 日志记录成功与失败便于排查。
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
   * 根据项目 ID（可选版本）分页查询 SourceMap。
   * 会直接透出分页元信息，并在查不到数据时抛出 404，提示调用方无对应版本。
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
   * 根据项目 + 文件名（可选版本）查询单个 SourceMap。
   * 主要用于调试定位具体 SourceMap 是否存在。
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
   * 更明确的 project + version 查询端点（无分页），适合一次性拉取全量数据。
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
   * 清理所有已过期 SourceMap。通常由后台任务或管理端触发。
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
   * 高级搜索端点：支持关键字搜索、过期状态过滤、内容展示等。
   *
   * （注意：当前实现为示例，调用 service.findByProjectAndVersion 并未根据 filter 过滤，后续可继续增强。）
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
    const allowedSortColumns: (keyof SourceMapEntity)[] = [
      'uploadedAt',
      'expiresAt',
      'filename',
      'version',
    ];
    const sortColumn = allowedSortColumns.includes(sortBy as keyof SourceMapEntity)
      ? (sortBy as keyof SourceMapEntity)
      : 'uploadedAt';

    try {
      const filter: any = {
        projectId: query['projectId'] || query['project'],
        version: query['version'],
        search,
        expirationStatus,
      };

      const normalizedSortOrder = sortOrder === SortOrder.ASC ? 'ASC' : 'DESC';
      const result = await this.sourceMapService.advancedSearch(
        filter,
        page,
        limit,
        sortColumn,
        normalizedSortOrder,
        includeContent ?? false
      );

      return {
        success: true,
        data: result.data.map((doc) => ({
          id: doc.id,
          filename: doc.filename,
          version: doc.version,
          uploadedAt: doc.uploadedAt,
          expiresAt: doc.expiresAt,
          ...(includeContent && { content: doc.content }),
        })),
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      };
    } catch (error) {
      throw new BadRequestException('Failed to search SourceMaps: ' + error.message);
    }
  }

  /**
   * 获取项目的版本列表与数量，帮助前端做版本选择器。
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
   * 批量操作，目前只支持 delete，可扩展其它 operation。
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
   * 健康检查：调用 service.getHealth 并附带请求耗时，用于仪表盘展示。
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
