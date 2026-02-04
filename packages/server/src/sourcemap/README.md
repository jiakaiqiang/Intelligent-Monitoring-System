# SourceMap API 测试指南

## 概述

本文档提供了 SourceMap 功能的完整测试指南，包括单元测试、集成测试和端到端测试。

## 测试结构

```
packages/server/src/sourcemap/
├── sourcemap.service.spec.ts      # 单元测试 - 服务层
├── sourcemap.controller.spec.ts   # 单元测试 - 控制器层
├── sourcemap.e2e-spec.ts          # 端到端测试
└── test-utils/                     # 测试工具
    ├── fixtures.ts               # 测试数据
    ├── mocking.ts               # Mock 工具
    └── helpers.ts               # 测试辅助函数
```

## 运行测试

### 运行所有测试
```bash
cd packages/server
npm test
```

### 运行测试并生成覆盖率报告
```bash
npm run test:cov
```

### 只运行单元测试
```bash
npm run test:unit
```

### 只运行端到端测试
```bash
npm run test:e2e
```

## 测试覆盖的功能点

### 1. SourceMap 上传测试

**文件**: `sourcemap.service.spec.ts`

```typescript
describe('create', () => {
  it('should create new source map documents', async () => {
    // 测试创建新的 SourceMap
  });

  it('should update existing source map', async () => {
    // 测试更新已存在的 SourceMap
  });

  it('should validate input data', async () => {
    // 测试数据验证
  });
});
```

### 2. SourceMap 查询测试

**文件**: `sourcemap.service.spec.ts` & `sourcemap.controller.spec.ts`

```typescript
describe('find', () => {
  it('should find with caching', async () => {
    // 测试缓存功能
  });

  it('should handle pagination', async () => {
    // 测试分页
  });
});
```

### 3. 错误映射测试

**文件**: `sourcemap.e2e-spec.ts`

```typescript
describe('EnhancedSourceMapParser', () => {
  it('should map stack trace to source', async () => {
    // 测试堆栈映射
  });

  it('should handle mapping errors', async () => {
    // 测试错误处理
  });
});
```

### 4. 性能测试

```typescript
describe('Performance', () => {
  it('should handle concurrent requests', async () => {
    // 并发请求测试
  });

  it('should cache efficiently', async () => {
    // 缓存效率测试
  });
});
```

## 测试数据准备

### 使用测试夹具

创建 `test-utils/fixtures.ts`:

```typescript
export const mockSourceMap = {
  filename: 'app.js.map',
  content: btoa(JSON.stringify({
    version: 3,
    sources: ['app.ts'],
    names: [],
    mappings: 'AAAA',
    sourceRoot: '/src'
  })),
  version: '1.0.0'
};

export const mockError = {
  message: 'Test error',
  stack: 'Error: Test error\n    at testFunction (app.js:1:1)',
  type: 'js' as const,
  timestamp: Date.now(),
  url: 'http://localhost'
};
```

### Mock 数据库

```typescript
const mockModel = {
  find: jest.fn(),
  findOne: jest.fn(),
  // ... 其他方法
};
```

## 测试最佳实践

1. **每个测试应该独立**: 使用 `beforeEach` 和 `afterEach` 清理状态
2. **Mock 外部依赖**: 特别是文件系统、数据库和网络请求
3. **测试边界条件**: 空值、大文件、无效数据等
4. **使用描述性测试名**: 清晰描述测试场景
5. **测试错误处理**: 确保错误被正确处理

## 持续集成

在 CI/CD 管道中添加测试步骤：

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: |
    cd packages/server
    npm test
  env:
    NODE_ENV: test
```

## 故障排除

### 常见问题

1. **Mock 失败**: 检查 mock 是否正确设置
2. **异步测试**: 确保 async/await 正确使用
3. **测试数据**: 验证测试数据格式是否正确

### 调试技巧

```typescript
// 在测试中添加调试信息
console.log('Mock calls:', mockModel.findOne.mock.calls);
```

## 贡献指南

添加新测试时：

1. 遵循现有测试结构
2. 保持测试简洁 focused
3. 添加必要的注释
4. 确保测试覆盖率