import { DocumentBuilder, SwaggerCustomOptions } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('SourceMap API')
  .setDescription('SourceMap management API endpoints for intelligent monitoring system')
  .setVersion('1.0.0')
  .setContact('API Support', 'support@monitoring.com', 'https://monitoring.com/docs')
  .setLicense('MIT', 'https://opensource.org/licenses/MIT')
  .addTag('SourceMaps', 'SourceMap upload and management')
  .addTag('Error Reports', 'Error report analysis and management')
  .addTag('AI Analysis', 'AI-powered error analysis and recommendations')
  .addTag('Health', 'Health check endpoints')
  .addBearerAuth()
  .addApiKey(
    {
      type: 'apiKey',
      name: 'X-API-Key',
      in: 'header',
      description: 'API key for authentication',
    },
    'api-key'
  )
  .build();

export const swaggerCustomOptions: SwaggerCustomOptions = {
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',
    defaultModelsExpandDepth: 1,
    defaultModelExpandDepth: 1,
    showRequestHeaders: true,
    showCommonExtensions: true,
  },
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin-top: 15px; }
    .swagger-ui .scheme-container { margin: 0 20px 20px 20px; }
    .swagger-ui .opblock { margin: 0 0 15px 0; }
    .swagger-ui .opblock-summary { padding: 0 10px; }
    .swagger-ui .opblock-description { padding: 0 10px; }
    .swagger-ui .opblock-section-header { padding: 10px; }
    .swagger-ui .opblock-body { padding: 0 10px; }
    .swagger-ui .parameter__name { width: 100%; }
    .swagger-ui .parameter__type { width: 100%; }
    .swagger-ui .parameter__in { width: 100%; }
    .swagger-ui .responses-wrapper { padding: 0 10px; }
    .swagger-ui .response-col_status { width: 100%; }
    .swagger-ui .response-col_description { width: 100%; }
  `,
  customCssUrl: '',
  customSiteTitle: 'SourceMap API Documentation',
  customJs: [],
};
