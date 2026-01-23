import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// import { MongooseModule } from '@nestjs/mongoose';
import { ReportModule } from './report/report.module';
import { AiModule } from './ai/ai.module';
// import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/monitor'),
    ReportModule,
    AiModule,
    // QueueModule,
  ],
})
export class AppModule {}
