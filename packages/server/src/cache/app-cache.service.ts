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
    await this.cacheManager.set(key, value, cacheTtl);
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async reset(): Promise<void> {
    // cache-manager v5+ doesn't have reset method, we'll clear the cache by deleting all keys
    // For now, we'll just leave this as a placeholder
    // await this.cacheManager.reset();
  }
}