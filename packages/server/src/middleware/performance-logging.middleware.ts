import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Logger } from '@nestjs/common';

/**
 * LoggerMiddleware：记录每一次 HTTP 请求/响应并统计耗时。
 *
 * - dev 环境会额外打印请求体、查询参数。
 * - 响应结束时根据耗时输出日志，超过 1s 触发 warn。
 */
@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip, body, params, query } = req;
    const userAgent = req.get('user-agent') || '';
    const startTime = Date.now();
    const logger = this.logger;

    // 入站日志：记录请求线索，方便与后续响应对齐
    logger.log(`[${method}] ${originalUrl} - IP: ${ip} - User-Agent: ${userAgent}`);

    // 在开发环境输出更详细的上下文，协助排查联调问题
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Request Body: ${JSON.stringify(body)}`);
      logger.debug(`Query Params: ${JSON.stringify(query)}`);
      logger.debug(`Route Params: ${JSON.stringify(params)}`);
    }

    // 通过重写 `res.end` 捕获响应完成时机，以计算耗时。
    const originalEnd = res.end;
    res.end = function (chunk?: any, encoding?: any) {
      const responseTime = Date.now() - startTime;
      const { statusCode } = this;

      // 响应日志：输出状态码与耗时，供性能监控/慢查询排查使用
      logger.log(`[${method}] ${originalUrl} ${statusCode} - ${responseTime}ms - IP: ${ip}`);

      // 当耗时超过 1s 时提示潜在性能问题
      if (responseTime > 1000) {
        logger.warn(`Slow request detected: ${originalUrl} took ${responseTime}ms`);
      }

      // 统一记录 4xx/5xx 以便集中分析错误热度
      if (statusCode >= 400) {
        logger.error(`Error response: ${statusCode} for ${originalUrl} - ${responseTime}ms`);
      }

      return originalEnd.call(this, chunk, encoding);
    };

    next();
  }
}
