# Intelligent Monitoring System

基于AI的前端异常监控系统，采用 Monorepo 架构。

## 项目结构

```
packages/
├── sdk/          # 前端监控 SDK
├── server/       # 后端服务 (Fastify)
├── dashboard/    # 可视化平台 (React + Vite)
└── shared/       # 共享代码
```

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
# 启动所有服务
pnpm dev

# 或单独启动
pnpm --filter @monitor/server dev
pnpm --filter @monitor/dashboard dev
```

### 构建

```bash
pnpm build
```

## 技术栈

- **Monorepo**: pnpm + Turborepo
- **SDK**: TypeScript + Rollup
- **Server**: Fastify + TypeScript
- **Dashboard**: React + Vite + TypeScript
- **AI**: Claude API (计划中)

## 功能特性

- ✅ 异常捕获 (JS错误、Promise错误)
- ✅ 性能监控 (Web Vitals)
- ✅ 用户行为追踪
- ✅ 数据上报
- 🚧 AI 智能分析
- 🚧 可视化平台
- 🚧 告警通知

## 架构文档

详见 `.plan/01-项目整体架构设计.md`
