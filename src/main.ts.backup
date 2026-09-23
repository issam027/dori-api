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
    .setTitle('DORI V3 — API Documentation')
    .setDescription(
      "Spécification fonctionnelle et technique du système de gestion de files d'attente et de rendez-vous DORI V3.",
    )
    .setVersion('3.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'DORI V3 — API Docs',
    swaggerOptions: {
      // Affiche les URLs de téléchargement dans le bandeau Swagger UI
      urls: [
        { url: '/api/docs-json', name: 'JSON' },
        { url: '/api/docs-yaml', name: 'YAML' },
      ],
      displayRequestDuration: true,
      persistAuthorization: true,
    },
    // Injecte un lien de téléchargement YAML en haut de la page
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
    customJs: '',
    jsonDocumentUrl: 'api/docs-json',
    yamlDocumentUrl: 'api/docs-yaml',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Serveur DORI V3 démarré sur http://localhost:${port}/${apiPrefix}`);
  logger.log(`Documentation Swagger disponible sur http://localhost:${port}/api/docs`);
}

bootstrap();