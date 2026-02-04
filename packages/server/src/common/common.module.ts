import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerMiddleware } from './middleware/performance-logging.middleware';
import { RateLimiterMiddleware } from './middleware/rate-limiter.middleware';

@Module({
  imports: [ConfigModule],
  providers: [LoggerMiddleware, RateLimiterMiddleware],
  exports: [],
})
export class CommonModule {}