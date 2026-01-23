# 使用指南

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动服务

#### 启动 MongoDB 和 Redis

```bash
# MongoDB
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Redis
docker run -d -p 6379:6379 --name redis redis:latest
```

#### 启动开发服务

```bash
# 启动所有服务
pnpm dev

# 或分别启动
pnpm --filter @monitor/server dev
pnpm --filter @monitor/dashboard dev
```

### 3. 使用 SDK

#### 安装

```bash
npm install @monitor/sdk
```

#### 基础使用

```javascript
import Monitor from '@monitor/sdk';

const monitor = new Monitor({
  projectId: 'your-project-id',
  reportUrl: 'http://your-server.com',
  maxErrors: 10,
  sampleRate: 1,
});
```

#### 使用插件

```javascript
import Monitor from '@monitor/sdk';
import { PluginManager } from '@monitor/sdk/plugins';

const pluginManager = new PluginManager();

// 注册自定义插件
pluginManager.register({
  name: 'custom-plugin',
  install: (monitor) => {
    console.log('Plugin installed');
  },
});

const monitor = new Monitor({
  projectId: 'your-project-id',
  reportUrl: 'http://your-server.com',
  plugins: pluginManager,
});
```

## 配置说明

### SDK 配置

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectId | string | 是 | 项目 ID |
| reportUrl | string | 是 | 上报地址 |
| maxErrors | number | 否 | 最大错误数，默认 10 |
| sampleRate | number | 否 | 采样率 0-1，默认 1 |
| plugins | PluginManager | 否 | 插件管理器 |

### 服务端配置

创建 `.env` 文件:

```bash
MONGO_URI=mongodb://localhost:27017
REDIS_HOST=localhost
REDIS_PORT=6379
ANTHROPIC_API_KEY=your_api_key
PORT=3000
```

## API 文档

### 上报接口

```
POST /api/report
```

请求体:

```json
{
  "projectId": "demo-project",
  "errors": [
    {
      "message": "Error message",
      "stack": "Error stack",
      "type": "js",
      "timestamp": 1234567890,
      "url": "http://example.com",
      "userAgent": "Mozilla/5.0..."
    }
  ],
  "performance": {
    "fcp": 1200,
    "lcp": 2500,
    "fid": 100,
    "cls": 0.1,
    "timestamp": 1234567890
  }
}
```

### 查询接口

```
GET /api/reports/:projectId
```

响应:

```json
{
  "data": [
    {
      "projectId": "demo-project",
      "errors": [...],
      "performance": {...},
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## 开发规范

### 代码风格

项目使用 ESLint 和 Prettier 进行代码规范检查:

```bash
# 检查代码
pnpm lint

# 格式化代码
pnpm format
```

### 提交规范

使用 Conventional Commits 规范:

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建/工具

示例:

```bash
git commit -m "feat(sdk): add plugin system"
git commit -m "fix(server): handle mongodb connection error"
```
