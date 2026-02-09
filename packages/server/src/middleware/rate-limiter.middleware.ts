import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

/**
 * RateLimiterMiddleware：为绝大多数 API 添加基础限流能力，防止爆破。
 */
@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private readonly limiter: ReturnType<typeof rateLimit>;

  constructor() {
    this.limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.',
        timestamp: new Date().toISOString(),
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipFailedRequests: true,
    });
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Apply rate limiting to all endpoints except health check
    if (!req.path.includes('/health')) {
      this.limiter(req, res, next);
    } else {
      next();
    }
  }
}
