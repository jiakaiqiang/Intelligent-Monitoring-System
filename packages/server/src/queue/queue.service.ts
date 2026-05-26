import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private client?: RedisClientType;
  private readonly logger = new Logger(QueueService.name);
  private enabled = false;

  async onModuleInit() {
    if (process.env.REDIS_QUEUE_ENABLED !== 'true' && process.env.AI_QUEUE_ENABLED !== 'true') {
      this.logger.log('Redis queue disabled');
      return;
    }

    this.client = createClient({
      url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
    });

    this.client.on('error', (error) => {
      this.enabled = false;
      this.logger.error('Redis queue client error', error);
    });

    try {
      await this.client.connect();
      this.enabled = true;
      this.logger.log('Redis queue client connected');
    } catch (error) {
      this.enabled = false;
      this.logger.error('Failed to connect Redis queue client', error as Error);
    }
  }

  async onModuleDestroy() {
    if (this.client?.isOpen) {
      await this.client.quit();
    }
  }

  isEnabled() {
    return this.enabled && Boolean(this.client?.isOpen);
  }

  async push(queue: string, data: any) {
    if (!this.isEnabled()) {
      return false;
    }

    await this.client!.rPush(queue, JSON.stringify(data));
    return true;
  }

  async pop(queue: string) {
    if (!this.isEnabled()) {
      return null;
    }

    const data = await this.client!.lPop(queue);
    return data ? JSON.parse(data) : null;
  }

  async length(queue: string) {
    if (!this.isEnabled()) {
      return 0;
    }

    return this.client!.lLen(queue);
  }
}
