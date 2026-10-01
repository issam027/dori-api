import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Security Headers (§7.3, §8.3)
  app.use(helmet());

  // CORS (§7.3, §8.3)
  const allowedOrigins = configService.get<string[]>('cors.allowedOrigins') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
  ];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-Id',
      'X-Registration-Token',
      'If-None-Match',
    ],
    exposedHeaders: ['X-Correlation-Id', 'ETag'],
  });

  // Global Validation Pipe with strict whitelisting (§7.3)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // OpenAPI 3 Specification / Swagger UI (§7.1)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Dori API')
    .setDescription(
      'Spécification de référence de la plateforme de gestion de files d’attente et de rendez-vous Dori',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Entrez votre token JWT d’accès',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-Registration-Token',
        in: 'header',
        description: 'Jeton public de suivi de position',
      },
      'registration-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      urls: [{ url: '/api/docs-json', name: 'OpenAPI JSON' }],
    },
  });

  const port = configService.get<number>('port') || 3000;
  await app.listen(port);
  logger.log(`Dori API server successfully started on port ${port}`);
  logger.log(
    `OpenAPI documentation available at http://localhost:${port}/api/docs`,
  );
}

bootstrap();
