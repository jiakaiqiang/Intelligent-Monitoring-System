import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient } from 'redis';

@Injectable()
export class QueueService implements OnModuleInit {
  private client;

  async onModuleInit() {
    this.client = createClient({
      url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
    });
    await this.client.connect();
  }

  async push(queue: string, data: any) {
    await this.client.rPush(queue, JSON.stringify(data));
  }

  async pop(queue: string) {
    const data = await this.client.lPop(queue);
    return data ? JSON.parse(data) : null;
  }

  async length(queue: string) {
    return this.client.lLen(queue);
  }
}
