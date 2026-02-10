import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as compression from 'compression';

/**
 * CompressionInterceptor
 * ----------------------
 * 该全局拦截器用于在 Nest 请求管道的响应阶段触发 `compression` 中间件。
 * 由于某些响应（例如流式响应）无法直接通过全局中间件压缩，
 * 我们在 `CallHandler` 完成数据处理之后、响应发送给客户端之前再次执行压缩逻辑，
 * 确保所有控制器都能享受到 gzip/br 压缩带来的带宽收益。
 */
@Injectable()
export class CompressionInterceptor implements NestInterceptor {
  /**
   * 在响应流完成时调用 `compression()`，以当前请求/响应对象为上下文执行压缩。
   * @param context ExecutionContext 提供对当前 HTTP 请求的访问
   * @param next CallHandler 表示后续处理链
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const request = context.switchToHttp().getRequest();
        // 通过再次执行 compression 中间件，将序列化后的响应压缩后发送给客户端
        compression()(request, response, () => {});
      })
    );
  }
}
