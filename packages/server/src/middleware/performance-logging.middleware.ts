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

    // Log request
    this.logger.log(`[${method}] ${originalUrl} - IP: ${ip} - User-Agent: ${userAgent}`);

    // Log request body and params only for development
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(`Request Body: ${JSON.stringify(body)}`);
      this.logger.debug(`Query Params: ${JSON.stringify(query)}`);
      this.logger.debug(`Route Params: ${JSON.stringify(params)}`);
    }

    // Override end method to添加耗时日志
    const originalEnd = res.end;
    res.end = function (chunk?: any, encoding?: any) {
      const responseTime = Date.now() - startTime;
      const { statusCode } = this;

      // Log response with performance metrics
      this.logger.log(`[${method}] ${originalUrl} ${statusCode} - ${responseTime}ms - IP: ${ip}`);

      // Log slow requests (>1000ms)
      if (responseTime > 1000) {
        this.logger.warn(`Slow request detected: ${originalUrl} took ${responseTime}ms`);
      }

      // Log errors
      if (statusCode >= 400) {
        this.logger.error(`Error response: ${statusCode} for ${originalUrl} - ${responseTime}ms`);
      }

      return originalEnd.call(this, chunk, encoding);
    };

    next();
  }
}
