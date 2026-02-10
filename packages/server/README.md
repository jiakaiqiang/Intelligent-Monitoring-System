# 异常监控后端系统 - NestJS

## 项目结构

```
packages/server/
├── src/
│   ├── main.ts                 # 应用入口
│   ├── app.module.ts           # 根模块
│   ├── report/                 # 异常报告模块
│   │   ├── report.controller.ts
│   │   ├── report.service.ts
│   │   ├── report.module.ts
│   │   └── entities/
│   │       └── report.entity.ts
│   ├── ai/                     # AI 分析模块
│   │   ├── ai.service.ts
│   │   └── ai.module.ts
│   └── queue/                  # 消息队列模块
│       ├── queue.service.ts
│       └── queue.module.ts
├── package.json
├── tsconfig.json
├── nest-cli.json
└── .env.example
```

## 核心模块

### 1. Report Module (异常报告模块)

负责接收、存储和查询前端上报的异常数据。

**功能：**

- 接收前端 SDK 上报的异常数据
- 使用 TypeORM 将数据写入 MySQL
- 提供查询接口
- 触发 AI 分析任务

**数据模型：**

```typescript
{
  projectId: string;           // 项目 ID
  errors: Array<{              // 错误列表
    message: string;
    stack: string;
    type: string;
    timestamp: number;
    url: string;
    userAgent: string;
  }>;
  performance: {               // 性能指标
    fcp?: number;
    lcp?: number;
    fid?: number;
    cls?: number;
    timestamp: number;
  };
  actions: Array<{             // 用户行为
    type: string;
    target: string;
    timestamp: number;
  }>;
  aiAnalysis?: string;         // AI 分析结果
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. AI Module (AI 分析模块)

使用 Claude API 对异常进行智能分析。

**功能：**

- 从队列获取待分析任务
- 调用 Claude API 分析错误
- 更新分析结果到数据库

**工作流程：**

1. Report 创建时，如果有错误，推送到 Redis 队列
2. AI Worker 定时从队列获取任务
3. 调用 Claude API 分析
4. 将分析结果写回数据库

### 3. Queue Module (消息队列模块)

基于 Redis 的消息队列服务。

**功能：**

- 推送任务到队列
- 从队列获取任务
- 查询队列长度

## API 接口

### 1. 上报异常

**接口：** `POST /api/report`

**请求体：**

```json
{
  "projectId": "demo-project",
  "errors": [
    {
      "message": "Uncaught TypeError: Cannot read property 'foo' of undefined",
      "stack": "Error: ...",
      "type": "js",
      "timestamp": 1706000000000,
      "url": "https://example.com/page",
      "userAgent": "Mozilla/5.0..."
    }
  ],
  "performance": {
    "fcp": 1200,
    "lcp": 2500,
    "fid": 100,
    "cls": 0.1,
    "timestamp": 1706000000000
  },
  "actions": [
    {
      "type": "click",
      "target": "button#submit",
      "timestamp": 1706000000000
    }
  ]
}
```

**响应：**

```json
{
  "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
  "projectId": "demo-project",
  "errors": [...],
  "performance": {...},
  "actions": [...],
  "createdAt": "2024-01-23T10:00:00.000Z",
  "updatedAt": "2024-01-23T10:00:00.000Z"
}
```

### 2. 查询异常报告

**接口：** `GET /api/reports/:projectId`

**参数：**

- `projectId`: 项目 ID

**响应：**

```json
{
  "data": [
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "projectId": "demo-project",
      "errors": [...],
      "performance": {...},
      "actions": [...],
      "aiAnalysis": "错误原因：...\n解决方案：...",
      "createdAt": "2024-01-23T10:00:00.000Z",
      "updatedAt": "2024-01-23T10:00:00.000Z"
    }
  ]
}
```

## 环境配置

创建 `.env` 文件：

```bash
PORT=3000
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=root
MYSQL_DB=monitor
REDIS_HOST=localhost
REDIS_PORT=6379
ANTHROPIC_API_KEY=your_api_key_here
```

## 安装依赖

```bash
cd packages/server
pnpm install
```

## 启动服务

### 1. 启动数据库

```bash
# MySQL
docker run -d \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=monitor \
  -p 3306:3306 \
  --name mysql \
  mysql:8

# Redis
docker run -d -p 6379:6379 --name redis redis:latest
```

### 2. 启动开发服务

```bash
pnpm dev
```

### 3. 构建生产版本

```bash
pnpm build
pnpm start
```

## 技术栈

- **框架：** NestJS 10
- **语言：** TypeScript 5
- **数据库：** MySQL 8 + TypeORM
- **缓存/队列：** Redis
- **AI：** Claude API (Anthropic)

## 核心特性

### 1. 模块化架构

- 采用 NestJS 模块化设计
- 依赖注入，易于测试和维护
- 清晰的职责分离

### 2. 异步处理

- 使用 Redis 队列异步处理 AI 分析
- 避免阻塞主请求流程
- 提高系统吞吐量

### 3. 数据库优化

- MySQL 索引优化 (projectId + createdAt)
- 支持高效查询和排序

### 4. AI 智能分析

- 集成 Claude 3.5 Sonnet
- 自动分析错误原因
- 提供解决方案建议

## 扩展功能

### 添加新的分析维度

在 `report/entities/report.entity.ts` 中扩展数据模型：

```typescript
@Prop({ type: Object })
customData: {
  // 自定义字段
};
```

### 添加新的 API 接口

在 `report.controller.ts` 中添加：

```typescript
@Get('reports/:projectId/stats')
async getStats(@Param('projectId') projectId: string) {
  return this.reportService.getStats(projectId);
}
```

### 自定义 AI 分析逻辑

在 `ai.service.ts` 中修改 `analyzeError` 方法：

```typescript
async analyzeError(errors: any[]) {
  const prompt = `自定义分析提示词：${JSON.stringify(errors)}`;
  // ...
}
```

## 性能优化建议

1. **批量上报：** 前端 SDK 批量上报，减少请求次数
2. **数据压缩：** 使用 gzip 压缩上报数据
3. **索引优化：** 根据查询模式添加合适的索引
4. **缓存策略：** 使用 Redis 缓存热点数据
5. **队列优化：** 调整 AI 分析队列的消费速度

## 监控和日志

建议集成：

- **日志：** Winston / Pino
- **监控：** Prometheus + Grafana
- **追踪：** OpenTelemetry

## 安全建议

1. 添加请求频率限制 (Rate Limiting)
2. 验证 projectId 合法性
3. 数据脱敏处理
4. API 鉴权机制
5. HTTPS 加密传输
