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
  Query
} from '@nestjs/common';
import { SourceMapService } from './sourcemap.service';
import { SourceMapInfo } from '../schemas/sourcemap.schema';

@Controller('api/sourcemaps')
export class SourceMapController {
  constructor(private readonly sourceMapService: SourceMapService) {}

  /**
   * 上传 SourceMap 文件
   */
  @Post()
  async upload(
    @Body() body: {
      projectId: string;
      sourceMaps: SourceMapInfo[];
    }
  ) {
    const { projectId, sourceMaps } = body;

    if (!projectId || !Array.isArray(sourceMaps)) {
      throw new BadRequestException('Invalid request body');
    }

    if (sourceMaps.length === 0) {
      throw new BadRequestException('No SourceMap files provided');
    }

    try {
      const documents = await this.sourceMapService.create(projectId, sourceMaps);
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
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to upload SourceMaps: ' + error.message);
    }
  }

  /**
   * 获取项目指定版本的所有 SourceMap
   */
  @Get(':projectId')
  async getByProject(
    @Param('projectId') projectId: string,
    @Query('version') version?: string
  ) {
    if (!projectId) {
      throw new BadRequestException('Project ID is required');
    }

    try {
      const sourceMaps = await this.sourceMapService.findByProjectAndVersion(projectId, version);

      if (sourceMaps.length === 0) {
        throw new NotFoundException(`No SourceMap found for project ${projectId}${version ? ` version ${version}` : ''}`);
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
   * 获取特定的 SourceMap
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
      const sourceMap = await this.sourceMapService.findOne({
        projectId,
        version,
        filename
      });

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
   * 清理过期的 SourceMap（管理员功能）
   */
  @Delete('cleanup')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cleanupExpired() {
    const deletedCount = await this.sourceMapService.cleanupExpired();
    return {
      success: true,
      message: `Cleaned up ${deletedCount} expired SourceMap files`
    };
  }
}