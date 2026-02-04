import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig, swaggerCustomOptions } from './swagger.config';
import * as compression from 'compression';
import { SwaggerDocument } from '@nestjs/swagger/dist/interfaces/swagger-document.interface';
import { LoggerMiddleware } from './middleware/performance-logging.middleware';
import { RateLimiterMiddleware } from './middleware/rate-limiter.middleware';
import { CompressionInterceptor } from './filter/compression.filter';
import { HttpExceptionFilter } from './filter/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(new CompressionInterceptor());

  // Enable compression for all responses
  app.use(compression());

  // Apply rate limiting middleware globally (except for health checks)
  app.use(new RateLimiterMiddleware());

  // Apply performance logging middleware globally
  app.use(new LoggerMiddleware());

  // Swagger configuration
  const document: SwaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, swaggerCustomOptions);

  // Also serve the JSON spec at a dedicated endpoint
  SwaggerModule.setup('api-json', app, document);

  // Configure CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'Accept'],
    credentials: true,
    maxAge: 86400,
  });

  // Add API key header middleware if needed
  app.use((req, res, next) => {
    // Allow Swagger UI to bypass CORS preflight
    if (req.path.startsWith('/api/docs')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, Accept');
    }
    next();
  });
  await app.listen(process.env.PORT || 3000);
  console.log(`Server running on http://localhost:${process.env.PORT || 3000}`);
  console.log(`Swagger documentation available at http://localhost:${process.env.PORT || 3000}/api/docs`);
  console.log(`Swagger JSON spec available at http://localhost:${process.env.PORT || 3000}/api-json`);
}
bootstrap();
