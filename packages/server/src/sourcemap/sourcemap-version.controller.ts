import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  UsePipes,
  ValidationPipe
} from '@nestjs/common';
import { SourceMapVersionService } from './sourcemap-version.service';
import {
  CreateVersionDto,
  CompareVersionsDto,
  RollbackDto,
  CleanupDto,
  SuggestVersionDto
} from './dto/version.dto';

@Controller('api/sourcemaps/:projectId/versions')
export class SourceMapVersionController {
  constructor(
    private readonly versionService: SourceMapVersionService
  ) {}

  /**
   * 获取项目所有版本信息
   */
  @Get()
  async getAllVersions(
    @Param('projectId') projectId: string,
    @Query('limit') limit?: number
  ) {
    if (!projectId) {
      throw new BadRequestException('Project ID is required');
    }

    const versions = await this.versionService.getAllVersions(projectId);

    return {
      success: true,
      data: limit ? versions.slice(0, parseInt(limit.toString())) : versions,
      total: versions.length
    };
  }

  /**
   * 获取版本历史
   */
  @Get('history')
  async getVersionHistory(
    @Param('projectId') projectId: string,
    @Query('limit') limit: string = '50'
  ) {
    if (!projectId) {
      throw new BadRequestException('Project ID is required');
    }

    const history = await this.versionService.getVersionHistory(
      projectId,
      parseInt(limit)
    );

    return {
      success: true,
      data: history
    };
  }

  /**
   * 创建新版本
   */
  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async createVersion(
    @Param('projectId') projectId: string,
    @Body() body: CreateVersionDto
  ) {
    if (!projectId) {
      throw new BadRequestException('Project ID is required');
    }

    const { version, sourceMaps, parentVersion } = body;

    try {
      const documents = await this.versionService.createVersion(
        projectId,
        version,
        sourceMaps,
        parentVersion
      );

      return {
        success: true,
        message: `Successfully created version ${version} with ${documents.length} files`,
        data: documents.map(doc => ({
          id: doc.id,
          filename: doc.filename,
          version: doc.version,
          uploadedAt: doc.uploadedAt
        }))
      };
    } catch (error) {
      if (error.message.includes('already exists')) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  /**
   * 回滚到指定版本
   */
  @Post('rollback')
  @UsePipes(new ValidationPipe({ transform: true }))
  async rollback(
    @Param('projectId') projectId: string,
    @Body() body: RollbackDto
  ) {
    if (!projectId) {
      throw new BadRequestException('Project ID is required');
    }

    const { targetVersion, newVersion } = body;

    try {
      const documents = await this.versionService.rollbackToVersion(
        projectId,
        targetVersion,
        newVersion
      );

      return {
        success: true,
        message: `Successfully rolled back from ${targetVersion} to ${newVersion}`,
        data: documents.map(doc => ({
          id: doc.id,
          filename: doc.filename,
          version: doc.version,
          uploadedAt: doc.uploadedAt
        }))
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  /**
   * 比较两个版本
   */
  @Post('compare')
  @UsePipes(new ValidationPipe({ transform: true }))
  async compareVersions(
    @Param('projectId') projectId: string,
    @Body() body: CompareVersionsDto
  ) {
    if (!projectId) {
      throw new BadRequestException('Project ID is required');
    }

    const { version1, version2 } = body;

    try {
      const comparison = await this.versionService.compareVersions(
        projectId,
        version1,
        version2
      );

      return {
        success: true,
        data: comparison
      };
    } catch (error) {
      throw new BadRequestException(`Failed to compare versions: ${error.message}`);
    }
  }

  /**
   * 自动版本检测和建议
   */
  @Get('suggest')
  async suggestNewVersion(
    @Param('projectId') projectId: string,
    @Query() query: SuggestVersionDto
  ) {
    if (!projectId) {
      throw new BadRequestException('Project ID is required');
    }

    const { currentVersion } = query;

    try {
      const suggestion = await this.versionService.suggestNewVersion(
        projectId,
        currentVersion
      );

      return {
        success: true,
        data: suggestion
      };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }

  /**
   * 清理过期版本
   */
  @Delete('cleanup')
  @UsePipes(new ValidationPipe({ transform: true }))
  async cleanupExpired(
    @Param('projectId') projectId: string,
    @Body() body: CleanupDto
  ) {
    if (!projectId) {
      throw new BadRequestException('Project ID is required');
    }

    const { force } = body;

    try {
      if (!force) {
        // 预览清理
        const info = await this.versionService.cleanupExpiredVersions(projectId);
        return {
          success: true,
          message: 'Preview cleanup result (use force=true to execute)',
          data: {
            preview: info,
            estimatedSpaceSaved: info.totalSize,
            versionsToClean: info.cleanedVersions.length
          }
        };
      }

      // 执行清理
      const result = await this.versionService.cleanupExpiredVersions(projectId);

      return {
        success: true,
        message: `Cleaned up ${result.cleanedVersions.length} versions`,
        data: result
      };
    } catch (error) {
      throw new BadRequestException(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * 批量版本清理
   */
  @Delete('batch')
  @HttpCode(HttpStatus.OK)
  async batchDelete(
    @Param('projectId') projectId: string,
    @Body() body: { versions: string[]; confirm: boolean }
  ) {
    const { versions, confirm } = body;

    if (!projectId) {
      throw new BadRequestException('Project ID is required');
    }

    if (!confirm) {
      return {
        success: false,
        message: 'Please set confirm=true to proceed with deletion'
      };
    }

    if (!versions || versions.length === 0) {
      throw new BadRequestException('At least one version must be specified');
    }

    const result = await this.versionService.batchVersionCleanup(projectId, versions);

    return {
      success: true,
      message: `Batch cleanup completed`,
      data: result
    };
  }

  /**
   * 获取版本详情
   */
  @Get(':version')
  async getVersionDetails(
    @Param('projectId') projectId: string,
    @Param('version') version: string
  ) {
    if (!projectId || !version) {
      throw new BadRequestException('Project ID and version are required');
    }

    // 获取版本信息
    const versions = await this.versionService.getAllVersions(projectId);
    const versionInfo = versions.find(v => v.version === version);

    if (!versionInfo) {
      throw new NotFoundException(`Version ${version} not found for project ${projectId}`);
    }

    // 获取版本中所有文件
    const files = await this.versionService.getAllVersions(projectId).then(versions =>
      versions.filter(v => v.version === version)
    );

    // 计算实际文件大小
    const totalSize = files.reduce((sum, file) => sum + (file.content?.length || 0), 0);

    return {
      success: true,
      data: {
        version: versionInfo.version,
        uploadedAt: versionInfo.uploadedAt,
        fileCount: files.length,
        totalSize,
        expiresAt: versionInfo.expiresAt,
        files
      }
    };
  }
}