import { IsString, IsArray, IsOptional, IsBoolean, MinLength, Matches, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVersionDto {
  @ApiProperty({
    description: 'Version number (semver format: x.y.z)',
    example: '1.2.3'
  })
  @IsString()
  @MinLength(1)
  @Matches(/^\d+\.\d+\.\d+$/, {
    message: 'Version must follow semver format (x.y.z)'
  })
  version: string;

  @ApiProperty({
    description: 'SourceMap files to include in this version',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        filename: { type: 'string', example: 'app.js.map' },
        content: { type: 'string', description: 'Base64 encoded SourceMap content' }
      }
    }
  })
  @IsArray()
  @IsObject({ each: true })
  sourceMaps: Array<{
    filename: string;
    content: string;
  }>;

  @ApiProperty({
    description: 'Parent version (for version branching)',
    example: '1.2.2',
    required: false
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d+\.\d+\.\d+$/, {
    message: 'Parent version must follow semver format (x.y.z)'
  })
  parentVersion?: string;
}

export class CompareVersionsDto {
  @ApiProperty({
    description: 'First version to compare',
    example: '1.1.0'
  })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, {
    message: 'Version must follow semver format (x.y.z)'
  })
  version1: string;

  @ApiProperty({
    description: 'Second version to compare',
    example: '1.2.0'
  })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, {
    message: 'Version must follow semver format (x.y.z)'
  })
  version2: string;
}

export class RollbackDto {
  @ApiProperty({
    description: 'Target version to rollback to',
    example: '1.1.0'
  })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, {
    message: 'Version must follow semver format (x.y.z)'
  })
  targetVersion: string;

  @ApiProperty({
    description: 'New version name for the rollback',
    example: '1.1.1-rollback'
  })
  @IsString()
  @MinLength(1)
  newVersion: string;
}

export class CleanupDto {
  @ApiProperty({
    description: 'Force execution without preview',
    example: false,
    required: false
  })
  @IsBoolean()
  @IsOptional()
  force?: boolean = false;
}

export class SuggestVersionDto {
  @ApiProperty({
    description: 'Current version to compare against',
    example: '1.2.0'
  })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, {
    message: 'Version must follow semver format (x.y.z)'
  })
  currentVersion: string;
}