import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

/**
 * QueueService：封装 Redis list 作为简单消息队列。
 *
 * - 初始化时建立单个 Redis 连接并复用。
 * - push 使用 rPush 追加任务，pop 使用 lPop 取出（先进先出）。
 * - length 可用于监控积压。
 */
@Injectable()
export class QueueService implements OnModuleInit {
  private client: RedisClientType;
  private readonly logger = new Logger(QueueService.name);

  async onModuleInit() {
    this.client = createClient({
      url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
    });
    await this.client.connect();
    this.logger.log('Redis queue client connected');
  }

  /** 将消息 push 到队列尾部，序列化为 JSON 字符串。 */
  async push(queue: string, data: any) {
    await this.client.rPush(queue, JSON.stringify(data));
  }

  /**
   * 从队列头部取出一个消息。若队列为空，返回 null。
   */
  async pop(queue: string) {
    const data = await this.client.lPop(queue);
    return data ? JSON.parse(data) : null;
  }

  /** 获取队列当前积压长度。 */
  async length(queue: string) {
    return this.client.lLen(queue);
  }
}
