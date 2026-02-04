import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';

@Injectable()
export class AppCacheService {
  constructor(
    private configService: ConfigService,
    private cacheManager: Cache,
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    return this.cacheManager.get<T>(key);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const cacheTtl = ttl || this.configService.get<number>('CACHE_TTL', 300);
    await this.cacheManager.set(key, value, { ttl: cacheTtl });
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async reset(): Promise<void> {
    await this.cacheManager.reset();
  }
}