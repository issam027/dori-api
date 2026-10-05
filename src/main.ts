// --- DIAGNOSTIC TEMPORAIRE : à retirer une fois le problème `pg` réglé ---
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pgVersion = require('pg/package.json').version;
  console.log('pg OK, version', pgVersion);
} catch (e) {
  console.error('pg FAILED:', e);
}
// --- FIN DIAGNOSTIC ---

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
  // CSP adaptée pour autoriser les assets Swagger UI chargés depuis cdnjs
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': [
            "'self'",
            "'unsafe-inline'",
            'https://cdnjs.cloudflare.com',
          ],
          'style-src': [
            "'self'",
            "'unsafe-inline'",
            'https://cdnjs.cloudflare.com',
          ],
          'img-src': ["'self'", 'data:', 'https://cdnjs.cloudflare.com'],
        },
      },
    }),
  );

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
    .setContact(
      'Dori Support',
      'https://dori.example.com',
      'support@dori.example.com',
    )
    .setLicense('Propriétaire', 'https://dori.example.com/license')
    .addServer('http://localhost:3000', 'Environnement local de développement')
    .addServer('https://dori-api.vercel.app/', 'Dori API Vercel')
    .addServer('https://api.dori.example.com', 'Environnement de production')
    .addTag(
      'Authentification',
      'Authentification, sessions et gestion des mots de passe',
    )
    .addTag('Sites', 'Gestion des sites et affectation des gestionnaires')
    .addTag('Queues', 'Gestion et configuration des files d’attente')
    .addTag('QueueEngine', 'Moteur d’ordonnancement et pilotage des appels')
    .addTag(
      'Registrations',
      'Inscriptions, prise de tickets et suivi de position',
    )
    .addTag('Persons', 'Gestion des profils usagers et historiques')
    .addTag('Users', 'Gestion des comptes utilisateurs et permissions')
    .addTag('Notifications', 'Gestion des règles et envoi des notifications')
    .addTag('Tiers', 'Gestion des forfaits et priorités de service')
    .addTag('Translations', 'Gestion des traductions et bundles multilingues')
    .addTag('Reports', 'Rapports statistiques et indicateurs d’activité')
    .addTag('Health', 'Vérification de la santé des composants et dépendances')
    .addTag('Système', 'Informations système')
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
    // Assets chargés depuis un CDN : les fichiers de swagger-ui-dist
    // ne sont pas toujours déployés sur Vercel
    customCssUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-standalone-preset.min.js',
    ],
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
