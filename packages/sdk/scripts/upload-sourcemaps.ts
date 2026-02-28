/**
 * SourceMap 上传脚本
 * 用于在构建后自动上传 sourcemap 到服务端
 *
 * 使用方式：
 *   node scripts/upload-sourcemaps.js --projectId my-project --version 1.0.0 --url http://localhost:3000 --files dist/*.map
 */

import { readFileSync, globSync } from 'fs';
import { join, basename } from 'path';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';

// 命令行参数解析
const args = process.argv.slice(2);
const options: Record<string, string[]> = {
  projectId: [],
  version: [],
  url: [],
  files: [],
};

let currentKey = '';
for (const arg of args) {
  if (arg.startsWith('--')) {
    currentKey = arg.slice(2);
  } else if (currentKey) {
    options[currentKey].push(arg);
  }
}

const projectId = options.projectId[0];
const version = options.version[0];
const reportUrl = options.url[0];
let files = options.files;

// 支持 glob 模式
if (files.length === 1 && files[0].includes('*')) {
  const { globSync } = await import('glob');
  files = globSync(files[0]);
}

if (!projectId || !version || !reportUrl || files.length === 0) {
  console.error(
    'Usage: node scripts/upload-sourcemaps.js --projectId <id> --version <ver> --url <url> --files <glob>'
  );
  console.error(
    'Example: node scripts/upload-sourcemaps.js --projectId my-app --version 1.0.0 --url http://localhost:3000 --files "dist/*.map"'
  );
  process.exit(1);
}

/**
 * 读取文件并转换为 Base64
 */
function readFileAsBase64(filePath: string): string {
  const content = readFileSync(filePath);
  return content.toString('base64');
}

/**
 * 上传单个 sourcemap
 */
async function uploadSourceMap(filePath: string, filename: string): Promise<void> {
  const content = readFileAsBase64(filePath);

  const payload = {
    projectId,
    sourceMap: {
      filename,
      content,
      version,
    },
  };

  const response = await fetch(`${reportUrl}/api/sourcemaps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }

  console.log(`✓ Uploaded: ${filename}`);
}

/**
 * 主函数
 */
async function main() {
  console.log(`\n🚀 Uploading SourceMaps to ${reportUrl}`);
  console.log(`   Project: ${projectId}`);
  console.log(`   Version: ${version}`);
  console.log(`   Files: ${files.length}\n`);

  const results = await Promise.allSettled(
    files.map((file) => uploadSourceMap(file, basename(file)))
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log(`\n📊 Results: ${succeeded} succeeded, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
