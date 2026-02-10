import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

/**
 * RateLimiterMiddleware：为绝大多数 API 添加基础限流能力，防止爆破。
 */
@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  /**
   * 使用 express-rate-limit 创建出来的中间件实例。
   * 被封装为字段是为了避免每次请求重新初始化配额窗口。
   */
  private readonly limiter: ReturnType<typeof rateLimit>;

  constructor() {
    this.limiter = rateLimit({
      // 以 15 分钟为一个限流周期，兼顾安全与普通业务吞吐
      windowMs: 15 * 60 * 1000,
      // 每个 IP 在一个窗口内最多调用 100 次 API
      max: 100,
      // 自定义返回体，前端可以复用统一的错误展示逻辑
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.',
        timestamp: new Date().toISOString(),
      },
      // 标准化的 `RateLimit-*` 响应头可以被 API Gateway 读取
      standardHeaders: true,
      legacyHeaders: false,
      // 失败的请求（例如 5xx）不会计入额度，避免雪崩时进一步阻塞恢复
      skipFailedRequests: true,
    });
  }

  /**
   * 将限流器应用到除健康检查外的所有路由。
   * 健康检查通常被负载均衡频繁探活，因此放行以免日志被噪声淹没。
   */
  use(req: Request, res: Response, next: NextFunction) {
    if (!req.path.includes('/health')) {
      this.limiter(req, res, next);
    } else {
      next();
    }
  }
}
