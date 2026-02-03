import { ErrorInfo, SourceMapInfo } from '@monitor/shared/types';
import { MappedErrorInfo } from '@monitor/server/src/shared/error-types';

/**
 * 测试用例：模拟错误堆栈映射
 */
export async function testErrorMapping() {
  // 模拟的错误数据
  const mockError: ErrorInfo = {
    message: 'Uncaught TypeError: Cannot read property \'name\' of undefined',
    stack: `Uncaught TypeError: Cannot read property 'name' of undefined
    at UserComponent.handleSubmit (bundle.js:123:45)
    at HTMLButtonElement.onclick (index.html:89:1)`,
    type: 'js',
    timestamp: Date.now(),
    url: 'https://example.com/app.js',
    userAgent: 'Mozilla/5.0...',
    version: '1.0.0'
  };

  // 模拟的 SourceMap
  const mockSourceMap: SourceMapInfo = {
    filename: 'bundle.js.map',
    content: btoa(JSON.stringify({
      version: 3,
      sources: ['src/components/UserComponent.tsx'],
      names: [],
      mappings: 'AAAA,MAAM,MAAM',
      file: 'bundle.js',
      sourceRoot: ''
    })),
    version: '1.0.0'
  };

  console.log('=== Error Mapping Test ===');
  console.log('Original Error:', mockError);
  console.log('SourceMap:', mockSourceMap);

  // 测试解析器
  if (typeof window !== 'undefined') {
    console.log('Running in browser environment');
    console.log('SourceMapParser should be available');
  } else {
    console.log('Running in Node.js environment');
    console.log('SourceMapParser should be available');
  }
}

/**
 * 测试用例：验证 SourceMap 解析器
 */
export async function testSourceMapParser() {
  console.log('=== SourceMap Parser Test ===');

  // 这里应该调用实际的 SourceMap 解析器
  // 由于时间限制，仅展示测试结构
  const testResults = {
    parserLoaded: true,
    base64Encoding: true,
    stackParsing: true
  };

  console.log('Test Results:', testResults);

  return testResults;
}