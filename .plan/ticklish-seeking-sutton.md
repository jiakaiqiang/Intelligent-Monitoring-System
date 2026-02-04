# 错误监控与 SourceMap 数据库设计计划

## 目标
为 **Intelligent Monitoring System** 构建完整的错误监控与 SourceMap（源码映射）数据库结构，实现异常上报、错误定位以及后续查询分析。

---
## 步骤方案（细化）
### 第一步：确定数据模型与字段
1. **收集业务需求**
   - 与产品/运维确认需记录的错误信息范围。
   - 决定是否需要关联用户 (`userId`) 与服务 (`service`)。
2. **设计核心字段**（所有项目均需）
   - `message`：原始错误信息字符串
   - `stackTrace`：原始堆栈追踪文本（可选）
   - `sourceFile`、`sourceLine`、`sourceColumn`：映射后文件路径、行号、列号
   - `timestamp`：错误发生时间戳
3. **设计可选关联字段**
   - `userId`：关联用户 ID（如需用户追踪）
   - `service`：所属微服务或模块名称（如需服务维度分析）
4. **决定关联表实现方式**
   - 若选 `userId`/`service`，创建独立 `User`、`Service` 集合并使用引用；否则直接以字符串存储。
5. **索引规划**
   - 为 `timestamp`、`service`（若有）建立单字段索引，以提升查询性能。
6. **产出文档**
   - 在 `docs/database.md` 中记录字段说明、索引策略及关联表设计。

### 第二步：实现代码层面的支持（细化）
1. **SourceMap 工具模块** (`utils/source-map.util.ts`)
   - 引入 `source-map` npm 包。
   - 实现 `loadSourceMap(filePath: string): Promise<SourceMapConsumer>` 用于读取 `.map` 文件并缓存。
   - 实现 `mapError(stackTrace: string): Promise<{file:string,line:number,column:number}>`，解析堆栈、定位最近的 `.map` 并返回映射位置。
   - 添加单元测试覆盖常见堆栈格式。
2. **错误上报服务** (`services/error-report.service.ts`)
   - 在全局异常捕获层（如 NestJS `ExceptionFilter`）中调用 `sourceMapUtil.mapError`。
   - 构造错误对象，填充第 1 步确定的字段。
   - 调用 Mongoose 模型保存。
   - 捕获并记录保存过程中的二次错误（防止上报导致系统崩溃）。
3. **Mongoose Schema 定义** (`schemas/error-report.schema.ts`)
   - 按第 1 步字段创建 `ErrorReportSchema`，使用 `ref` 关联（若有）。
   - 在 `app.module.ts` 中 `MongooseModule.forFeature([{ name: 'ErrorReport', schema: ErrorReportSchema }])` 注册。
4. **可选关联模型**
   - `schemas/user.schema.ts`：最小化 `User` 模型（`_id`, `username`）。
   - `schemas/service.schema.ts`：`Service` 模型（`name`, `description`）。
   - 在 `ErrorReportSchema` 中添加 `userId: { type: Schema.Types.ObjectId, ref: 'User' }`、`service: { type: String }`（或 `ref: 'Service'`）。
5. **数据库迁移脚本**（如果已有生产库）
   - 编写迁移脚本在现有库中创建 `errorreports` 集合并添加索引。
   - 提供回滚方案（删除集合/索引）。

### 第三步：验证、测试与文档（细化）
1. **单元测试**
   - `utils/source-map.util.spec.ts`：使用已知的压缩文件及其 `.map`，断言 `mapError` 返回正确的源文件/行列。
   - `services/error-report.service.spec.ts`：模拟异常，验证生成的文档包含所有必填字段。
2. **集成测试**
   - 启动完整后端服务，发送导致异常的 HTTP 请求，检查 MongoDB 中 `errorreports` 文档是否完整。
   - 测试关联字段（若启用），确保 `populate` 能正确返回用户/服务信息。
3. **手动验证**
   - 本地运行服务，手动抛出 `new Error('test')`，使用 MongoDB 客户端检查记录。
   - 验证 `sourceFile`、`sourceLine`、`sourceColumn` 与源码对应。
4. **性能验证**
   - 使用 `ab` 或 `hey` 对错误上报接口进行压测（如 1000 次并发），确认延迟在可接受范围，且数据库写入不会成为瓶颈。
5. **文档撰写**
   - 更新 `README` 或 `docs/error-monitoring.md`，包括：
     - 错误报告结构示例
     - 如何在新微服务中集成 `source-map.util`
     - 部署 `.map` 文件的路径约定
     - 查询示例（按时间、服务、用户过滤）
6. **上线准备**
   - 确认所有索引已创建。
   - 在 CI 流水线中加入 `npm test` 以及迁移脚本的执行。
   - 部署时确保每个微服务的构建产物包含对应的 `.map` 文件。

---
## 交付物
- 更新的 Mongoose Schema（`error-report.schema.ts`）
- 完整的 SourceMap 工具实现（`utils/source-map.util.ts`）
- 错误上报服务代码（`services/error-report.service.ts`）
- 可选的关联模型文件（`schemas/user.schema.ts`、`schemas/service.schema.ts`）
- 数据库迁移脚本
- 单元/集成测试代码
- 文档章节（`docs/error-monitoring.md`）
- CI/部署脚本示例

**请确认上述细化后的计划是否满足需求。**