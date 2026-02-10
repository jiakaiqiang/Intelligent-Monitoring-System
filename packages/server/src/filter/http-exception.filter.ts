import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger } from '@nestjs/common';

/**
 * HttpExceptionFilter
 * --------------------
 * 捕捉所有 `HttpException`，并将其转换为统一的响应格式结构。
 * 该过滤器不仅规范了返回数据，还补充了时间戳、请求路径等调试信息，
 * 同时借助 Nest Logger 输出结构化日志，方便我们在 APM/日志收集中追踪问题。
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  /**
   * 将原始异常转换为标准对象，并写入响应与日志。
   * @param exception 捕获到的 HttpException
   * @param host 提供当前执行上下文 (HTTP)
   */
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // 若异常非 HttpException，兜底为 500，避免 `getStatus` 抛错
    const status = exception instanceof HttpException ? exception.getStatus() : 500;

    // 保留框架自带的响应体（可能是字符串/对象），用于拼装友好的错误描述
    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const errorResponse = {
      success: false,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error: {
        code: status,
        message:
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : (exceptionResponse as any).message || 'Unknown error',
        details:
          typeof exceptionResponse === 'object' && 'response' in exceptionResponse
            ? (exceptionResponse as any).response
            : null,
      },
    };

    // 记录关键上下文 + 堆栈，方便结合 traceId／链路ID定位
    this.logger.error(
      `${request.method} ${request.url} - ${status}: ${errorResponse.error.message}`,
      exception.stack
    );

    response.status(status).json(errorResponse);
  }
}
