import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as compression from 'compression';
import { CompressionInterceptor } from './filter/compression.filter';
import { HttpExceptionFilter } from './filter/http-exception.filter';

/**
 * 应用程序启动引导函数
 * 负责创建NestJS应用实例，配置全局过滤器、拦截器、中间件等
 */
async function bootstrap() {
  // 创建NestJS应用实例
  const app = await NestFactory.create(AppModule);

  // 注册全局异常过滤器，用于统一处理HTTP异常
  app.useGlobalFilters(new HttpExceptionFilter());

  // 注册全局压缩拦截器，用于压缩响应数据
  app.useGlobalInterceptors(new CompressionInterceptor());

  // 启用响应压缩中间件，减少网络传输数据量
  app.use(compression());

  // 配置跨域资源共享(CORS)，允许前端应用访问后端API
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*', // 允许的源域名
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // 允许的HTTP方法
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'Accept'], // 允许的请求头
    credentials: true, // 是否允许携带凭证信息
    maxAge: 86400, // 预检请求缓存时间(秒)
  });

  // 启动服务器并监听指定端口
  await app.listen(process.env.PORT || 3000);
  console.log(`Server running on http://localhost:${process.env.PORT || 3000}`);
}

// 执行应用启动函数
bootstrap();
