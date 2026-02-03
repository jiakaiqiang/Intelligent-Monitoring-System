# 智能监控系统 - SourceMap 支持实现计划

## 背景概述

智能监控系统已经有基础的错误收集和上报功能，以及一个简单的 SourceMap 解析器。但系统目前不支持上传和管理 SourceMap 文件，导致无法将生产环境的错误堆栈准确映射回源代码位置。

## 需求分析

### 现有功能
- SDK 已具备错误收集和上报能力
- 已有基础的 SourceMap 解析器（`SourceMapParser`）
- 后端有接收报告的 API（`POST /api/jkq`）

### 缺失功能
1. **SDK 端**
   - 没有上传 SourceMap 文件的机制
   - 错误上报时没有包含项目版本信息
   - SourceMap 解析器功能不完善（只支持从 URL 获取，不支持本地解析）

2. **服务端**
   - 没有 SourceMap 存储方案
   - 没有管理项目版本的机制
   - 没有将 SourceMap 与错误关联的分析逻辑

## 实现方案（分阶段实现）

### 阶段一：核心功能实现（最优先）

#### 1.1 更新错误数据结构
- 在 `ErrorInfo` 接口中添加 `version` 字段，用于标识错误发生时的项目版本
- 在 `ReportData` 中添加 `sourceMaps` 字段，支持上传多个 SourceMap 文件

#### 1.2 实现 SourceMap 上传功能（基础版）
- 创建 `SourceMapUploader` 类，负责上传 SourceMap 文件
- 支持通过配置指定 SourceMap 文件的位置或直接上传文件内容
- **版本号通过 Monitor 配置手动传入**（采用手动指定策略）
- 实现 SourceMap 文件 Base64 编码和上传功能

#### 1.3 增强 SourceMap 解析器
- 支持从上传的 SourceMap 文件中进行解析
- 缓存已解析的 SourceMap，提高解析效率
- 使用 `source-map` 库进行准确的堆栈映射

#### 1.4 服务端基础支持
- 创建 SourceMap 存储模型
- 实现 SourceMap 上传 API（`POST /api/sourcemaps`）
- 创建基础的错误映射逻辑
- 启用 MongoDB 连接（取消 app.module.ts 中的注释）

### 阶段二：功能完善和优化

#### 2.1 错误处理增强
- 接收到错误报告时，查找对应的 SourceMap
- 使用 SourceMap 解析器将错误堆栈转换为源码位置
- 存储映射后的错误信息，便于查看

#### 2.2 前端显示优化
- 在错误详情页面显示映射后的源码位置
- 提供跳转到源码的功能（如果适用）
- 显示错误的源文件路径、行号和列号

#### 2.3 API 完善
- 实现 SourceMap 查询 API（`GET /api/sourcemaps/:projectId/:version`）
- 优化数据库查询性能
- 添加基础的验证和错误处理

### 阶段三：高级功能（可选）

#### 3.1 SourceMap 版本管理增强
- 自动检测项目版本变更
- 支持回滚到特定版本的 SourceMap
- 提供版本对比功能

#### 3.2 集成构建工具
- 支持从 CI/CD 流程中自动上传 SourceMap
- 与 Webpack、Vite 等构建工具集成
- 提供构建钩子自动收集 SourceMap

## 关键文件修改

### SDK 端
1. `packages/shared/types/index.ts` - 更新类型定义
2. `packages/sdk/core/index.ts` - 增强错误上报逻辑
3. `packages/sdk/core/sourcemap.ts` - 完善 SourceMap 解析器
4. 新增：`packages/sdk/core/source-uploader.ts` - SourceMap 上传器

### 服务端
1. `packages/server/src/report/schemas/report.schema.ts` - 更新数据模型
2. 新增：`packages/server/src/schemas/sourcemap.schema.ts` - SourceMap 模型
3. `packages/server/src/report/report.controller.ts` - 增强控制器
4. `packages/server/src/report/report.service.ts` - 增强服务逻辑
5. 新增：`packages/server/src/sourcemap/` - SourceMap 管理模块

## 测试计划

1. **单元测试**
   - SourceMap 解析器测试
   - 文件上传功能测试
   - 错误映射逻辑测试

2. **集成测试**
   - 完整的上传-存储-映射流程测试
   - 多版本 SourceMap 管理测试
   - 错误场景测试（无效 SourceMap、版本不匹配等）

3. **端到端测试**
   - 使用示例项目演示完整的 SourceMap 功能
   - 验证错误堆栈的准确性
   - 测试前端展示效果

## 部署说明

1. **环境准备**
   - 确保 MongoDB 服务已启动
   - 配置适当的存储空间
   - 设置文件大小限制

2. **配置更新**
   - 启用数据库连接
   - 配置 API 路径
   - 设置安全策略

3. **监控与维护**
   - 监控 SourceMap 存储空间使用情况
   - 定期清理过期或重复的 SourceMap
   - 优化查询性能