# SourceMap 功能测试指南

本文档提供了测试已实现的 SourceMap 功能的步骤和方法。

## 功能概述

已完成的 SourceMap 功能包括：

### 阶段一（已完成）
1. ✅ 更新错误数据结构
2. ✅ 实现 SourceMap 上传功能
3. ✅ 增强 SourceMap 解析器
4. ✅ 服务端基础支持

### 阶段二（部分完成）
5. ✅ 错误处理增强
6. ⏳ 前端显示优化
7. ⏳ API完善

## 测试步骤

### 1. 启动服务

```bash
# 启动服务器
cd packages/server
pnpm dev
```

### 2. 浏览器端测试

打开浏览器控制台，然后引入测试脚本：

```javascript
// 复制 test/api.test.ts 的内容到控制台执行
// 或者创建一个 HTML 文件引用
```

### 3. 测试用例

#### 3.1 SourceMap 上传测试

```javascript
// 上传 SourceMap 文件
const sourceMapData = {
  projectId: 'your-project-id',
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

fetch('http://localhost:3000/api/sourcemaps', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(sourceMapData)
});
```

#### 3.2 错误上报测试

```javascript
// 上报包含 SourceMap 的错误
const errorReport = {
  projectId: 'your-project-id',
  errors: [{
    message: 'ReferenceError: variable is not defined',
    stack: `ReferenceError: variable is not defined
    at App.render (main.js:45:32)
    at StrictMode (index.js:15:2)`,
    type: 'js',
    timestamp: Date.now(),
    url: 'https://example.com/',
    userAgent: 'Mozilla/5.0...',
    version: '1.0.0'
  }],
  sourceMaps: [{
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
  }]
};

fetch('http://localhost:3000/api/jkq', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(errorReport)
});
```

#### 3.3 查询测试

```javascript
// 查询项目的 SourceMap
fetch('http://localhost:3000/api/sourcemaps/your-project-id?version=1.0.0')
  .then(res => res.json())
  .then(data => console.log(data));
```

## 预期结果

### 错误堆栈映射

原始堆栈：
```
ReferenceError: variable is not defined
    at App.render (main.js:45:32)
    at StrictMode (index.js:15:2)
```

映射后堆栈：
```
ReferenceError: variable is not defined
    at App.render (src/App.tsx:23:10)
    at StrictMode (index.tsx:45:2)
```

## 注意事项

1. 确保 MongoDB 已启动并连接
2. 项目版本号必须一致
3. SourceMap 文件名要与压缩文件对应
4. 使用 Base64 编码上传 SourceMap 内容

## 故障排查

### 常见问题

1. **错误：SourceMap 映射失败**
   - 检查 SourceMap 文件是否正确上传
   - 验证版本号是否匹配
   - 确保 SourceMap 文件路径正确

2. **错误：MongoDB 连接失败**
   - 检查 MongoDB 服务是否运行
   - 验证连接字符串是否正确
   - 确保数据库名称存在

3. **错误：文件过大**
   - 检查文件大小是否超过 10MB 限制
   - 压缩 SourceMap 文件

## 性能优化

1. 使用缓存减少重复解析
2. 定期清理过期的 SourceMap 文件
3. 对 SourceMap 文件进行压缩存储

## 下一步

继续完成阶段二的任务：
- 前端显示优化：在错误详情页面显示映射后的源码位置
- API 完善：添加更多查询和优化功能