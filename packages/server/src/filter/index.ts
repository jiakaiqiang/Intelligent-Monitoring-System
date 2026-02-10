// filter/index.ts
// ---------------
// 集中导出所有过滤器/拦截器，便于在模块或 main.ts 中统一引入。
import { CompressionInterceptor } from './compression.filter';

export { CompressionInterceptor };
