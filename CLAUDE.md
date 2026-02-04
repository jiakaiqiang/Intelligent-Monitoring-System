# CLAUDE.md

此文件为 Claude Code（claude.ai/code）在本仓库中工作时提供指导。

## 项目概述

**Intelligent Monitoring System（智能监控系统）** 是一个使用 **pnpm** 与 **TurboRepo** 的 monorepo。它包含以下主要包：

- `packages/sdk` – 前端监控 SDK（TypeScript，使用 Rollup 构建）。
- `packages/server` – 后端服务（NestJS，TypeScript），处理错误报告、AI 分析以及 Redis 队列。
- `packages/dashboard` – 可视化平台（React + Vite）。
- `packages/shared` – 跨包共享的工具函数和类型。

服务器包包含三个核心模块：

- **报告模块** – 接收、存储并查询错误报告。
- **AI 模块** – 从 Redis 拉取任务，调用 Claude API 进行分析，并存储结果。
- **队列模块** – 基于 Redis 的简单消息队列，实现异步处理。

## 常用开发命令

所有命令均在根目录的 `package.json` 中定义，使用 **pnpm** 运行：

- **构建整个 monorepo**：`pnpm build`
- **以开发模式运行所有包**：`pnpm dev`
- **运行单个包**（例如 server）：`pnpm --filter @monitor/server dev`
- **仅运行仪表盘**：`pnpm --filter @monitor/dashboard dev`
- **运行 lint 检查**：`pnpm lint`
- **运行测试**：`pnpm test`
- **运行单个测试文件**（Turbo 直接运行目标）：`pnpm test -- <相对路径-至-测试文件>`
- **使用 Prettier 格式化代码**：`pnpm format`

## 各包实用脚本

### Server (`packages/server`)
- 安装依赖：`cd packages/server && pnpm install`
- 本地启动服务（开发模式）：`pnpm dev`
- 构建生产环境服务器：`pnpm build`
- 运行服务器测试：`pnpm test`

### Dashboard (`packages/dashboard`)
- 安装依赖：`cd packages/dashboard && pnpm install`
- 启动 UI 开发服务器：`pnpm dev`
- 构建生产环境 UI：`pnpm build`

### SDK (`packages/sdk`)
- 安装依赖：`cd packages/sdk && pnpm install`
- 构建 SDK 包：`pnpm build`

## 快速启动检查清单

1. 安装所有依赖：`pnpm install`
2. 启动所需服务（MongoDB、Redis）——请参阅 `packages/server/README.md` 中的 Docker 命令。
3. 以开发模式运行完整栈：`pnpm dev`
4. 在浏览器访问 API `http://localhost:3000`，以及仪表盘在 Vite 开发服务器打印的地址。

---

*由 Claude Code 生成*。
