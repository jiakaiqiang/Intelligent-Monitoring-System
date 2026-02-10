import { DocumentBuilder, SwaggerCustomOptions } from '@nestjs/swagger';

/**
 * Swagger配置对象
 * 用于配置API文档的元数据和显示选项
 */
export const swaggerConfig = new DocumentBuilder()
  // 设置API文档标题
  .setTitle('SourceMap API')
  // 设置API文档描述
  .setDescription('SourceMap management API endpoints for intelligent monitoring system')
  // 设置API版本号
  .setVersion('1.0.0')
  // 设置联系信息
  .setContact('API Support', 'support@monitoring.com', 'https://monitoring.com/docs')
  // 设置许可证信息
  .setLicense('MIT', 'https://opensource.org/licenses/MIT')
  // 添加标签分类
  .addTag('SourceMaps', 'SourceMap upload and management')
  .addTag('Error Reports', 'Error report analysis and management')
  .addTag('AI Analysis', 'AI-powered error analysis and recommendations')
  .addTag('Health', 'Health check endpoints')
  // 添加Bearer认证方式
  .addBearerAuth()
  // 添加API密钥认证方式
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

/**
 * Swagger自定义选项配置
 * 用于定制Swagger UI的外观和行为
 */
export const swaggerCustomOptions: SwaggerCustomOptions = {
  swaggerOptions: {
    // 持久化授权信息
    persistAuthorization: true,
    // 显示请求持续时间
    displayRequestDuration: true,
    // 默认不展开文档内容
    docExpansion: 'none',
    // 启用过滤功能
    filter: true,
    // 按字母顺序排序标签
    tagsSorter: 'alpha',
    // 按字母顺序排序操作
    operationsSorter: 'alpha',
    // 模型展开深度
    defaultModelsExpandDepth: 1,
    // 模型属性展开深度
    defaultModelExpandDepth: 1,
    // 显示请求头信息
    showRequestHeaders: true,
    // 显示通用扩展信息
    showCommonExtensions: true,
  },
  // 自定义CSS样式
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
  // 自定义CSS文件URL
  customCssUrl: '',
  // 自定义站点标题
  customSiteTitle: 'SourceMap API Documentation',
  // 自定义JavaScript文件
  customJs: [],
};
