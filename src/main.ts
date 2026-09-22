import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './core/errors/http-exception.filter';
import { TransformResponseInterceptor } from './core/response/transform-response.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 1. Sécurité HTTP (§7.3, §8.3)
  app.use(helmet());

  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:4200'];

  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // 2. Préfixe d'API versionné (§5.1)
  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // 3. Validation globale stricte (§7.3)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 4. Intercepteur de réponse standard et filtre global (§5.1, §7.4)
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new TransformResponseInterceptor(reflector));
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 5. Documentation OpenAPI 3 / Swagger (§7.1)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('DORI-TN V3 — API Documentation')
    .setDescription(
      "Spécification fonctionnelle et technique du système de gestion de files d'attente et de rendez-vous DORI-TN V3.",
    )
    .setVersion('3.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'DORI-TN V3 — API Docs',
    // CDN avec la version exacte : 5.32.13
    customCssUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.32.13/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.32.13/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.32.13/swagger-ui-standalone-preset.min.js',
    ],
    swaggerOptions: {
      urls: [
        { url: '/api/docs-json', name: 'JSON' },
        { url: '/api/docs-yaml', name: 'YAML' },
      ],
      displayRequestDuration: true,
      persistAuthorization: true,
    },
    customCss: `
      .swagger-ui .topbar-wrapper::after {
        content: '';
      }
      .download-links {
        display: flex;
        gap: 8px;
        padding: 4px 12px;
        align-items: center;
      }
    `,
    customfavIcon: '',
    jsonDocumentUrl: 'api/docs-json',
    yamlDocumentUrl: 'api/docs-yaml',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`🚀 Serveur DORI-TN V3 démarré sur http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 Documentation Swagger disponible sur http://localhost:${port}/api/docs`);
}

bootstrap();