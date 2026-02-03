/**
 * 测试服务器端 API 请求
 */
const API_BASE_URL = 'http://localhost:3000';

/**
 * 测试 SourceMap 上传 API
 */
async function testSourceMapUpload() {
  console.log('=== Testing SourceMap Upload API ===');

  const sourceMapData = {
    projectId: 'test-project',
    sourceMaps: [
      {
        filename: 'main.js.map',
        content: btoa(JSON.stringify({
          version: 3,
          sources: ['src/index.ts'],
          names: [],
          mappings: '',
          file: 'main.js',
          sourceRoot: ''
        })),
        version: '1.0.0'
      }
    ]
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/sourcemaps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sourceMapData)
    });

    const result = await response.json();
    console.log('Upload Result:', result);
  } catch (error) {
    console.error('Upload failed:', error.message);
  }
}

/**
 * 测试错误上报 API
 */
async function testErrorReport() {
  console.log('=== Testing Error Report API ===');

  const errorReport = {
    projectId: 'test-project',
    errors: [
      {
        message: 'ReferenceError: variable is not defined',
        stack: `ReferenceError: variable is not defined
        at App.render (main.js:45:32)
        at StrictMode (index.js:15:2)`,
        type: 'js',
        timestamp: Date.now(),
        url: 'https://example.com/',
        userAgent: 'Mozilla/5.0...',
        version: '1.0.0'
      }
    ],
    sourceMaps: [
      {
        filename: 'main.js.map',
        content: btoa(JSON.stringify({
          version: 3,
          sources: ['src/App.tsx'],
          names: [],
          mappings: '',
          file: 'main.js',
          sourceRoot: ''
        })),
        version: '1.0.0'
      }
    ]
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/jkq`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorReport)
    });

    const result = await response.json();
    console.log('Report Result:', result);
  } catch (error) {
    console.error('Report failed:', error.message);
  }
}

/**
 * 测试查询 API
 */
async function testQueryAPI() {
  console.log('=== Testing Query API ===');

  try {
    // 查询项目的 SourceMap
    const response = await fetch(`${API_BASE_URL}/api/sourcemaps/test-project?version=1.0.0`);
    const result = await response.json();
    console.log('Query Result:', result);
  } catch (error) {
    console.error('Query failed:', error.message);
  }
}

// 运行测试
if (typeof window !== 'undefined') {
  // 浏览器环境
  console.log('Running tests in browser');

  // 添加测试按钮到页面
  const testContainer = document.createElement('div');
  testContainer.style.position = 'fixed';
  testContainer.style.top = '20px';
  testContainer.style.right = '20px';
  testContainer.style.padding = '20px';
  testContainer.style.background = 'white';
  testContainer.style.border = '1px solid #ccc';
  testContainer.style.borderRadius = '8px';
  testContainer.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';

  testContainer.innerHTML = `
    <h3>测试控制台</h3>
    <button onclick="testSourceMapUpload()" style="margin: 5px;">测试 SourceMap 上传</button>
    <button onclick="testErrorReport()" style="margin: 5px;">测试错误上报</button>
    <button onclick="testQueryAPI()" style="margin: 5px;">测试查询 API</button>
    <div id="test-output" style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px;"></div>
  `;

  // 将函数暴露到全局
  (window as any).testSourceMapUpload = testSourceMapUpload;
  (window as any).testErrorReport = testErrorReport;
  (window as any).testQueryAPI = testQueryAPI;
  (window as any).testOutput = document.getElementById('test-output') || testContainer.querySelector('#test-output');

  document.body.appendChild(testContainer);
} else {
  // Node.js 环境
  testSourceMapUpload();
  testErrorReport();
  testQueryAPI();
}