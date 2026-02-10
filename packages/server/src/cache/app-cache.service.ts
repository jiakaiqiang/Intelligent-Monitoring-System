import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';

/**
 * AppCacheService
 * ---------------
 * 对 cache-manager 进行一层封装，统一处理 TTL 配置与泛型类型声明，
 * 方便业务模块/装饰器在不关心缓存驱动实现的情况下，快速读写缓存。
 */
@Injectable()
export class AppCacheService {
  constructor(
    private configService: ConfigService,
    private cacheManager: Cache
  ) {}

  /**
   * 根据 key 读取缓存，同时保留泛型信息。
   * 如果 key 不存在，cache-manager 会返回 undefined。
   */
  async get<T>(key: string): Promise<T | undefined> {
    return this.cacheManager.get<T>(key);
  }

  /**
   * 写入缓存，未指定 ttl 时使用环境变量中的默认值（单位：秒）。
   * 通过 ConfigService 读取配置，便于不同环境灵活调整缓存策略。
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const cacheTtl = ttl || this.configService.get<number>('CACHE_TTL', 300);
    await this.cacheManager.set(key, value, cacheTtl);
  }

  /**
   * 删除某个缓存 key，常用于主动失效或在写操作后保持一致性。
   */
  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  /**
   * 重置缓存。cache-manager v5 之后暂未提供 reset API，
   * 如需实现可在此封装底层驱动的自定义清理逻辑。
   */
  async reset(): Promise<void> {
    // cache-manager v5+ doesn't have reset method, we'll clear the cache by deleting all keys
    // For now, we'll just leave this as a placeholder
    // await this.cacheManager.reset();
  }
}
