import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import type { IncomingMessage, ServerResponse } from 'http';
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { ConfiguredIoAdapter } from './core/realtime/configured-io.adapter';
import {
  createOpenApiConfig,
  normalizeOpenApiDocument,
} from './core/swagger/openapi.config';
import { PositiveIdParamPipe } from './core/validation/positive-id-param.pipe';

async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  const configService = app.get(ConfigService);
  const isVercel = configService.get<boolean>('platform.isVercel') ?? false;
  app.use(cookieParser());

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

  const allowedOrigins = configService.getOrThrow<string[]>(
    'cors.allowedOrigins',
  );

  // WebSockets can't run on serverless functions
  if (!isVercel) {
    app.useWebSocketAdapter(new ConfiguredIoAdapter(app, allowedOrigins));
  }

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

  app.useGlobalPipes(
    new PositiveIdParamPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const document = normalizeOpenApiDocument(
    SwaggerModule.createDocument(app, createOpenApiConfig()),
  );
  SwaggerModule.setup('api/docs', app, document, {
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

  // Redirige la racine vers la documentation Swagger
  app
    .getHttpAdapter()
    .get('/', (_req: unknown, res: { redirect: (url: string) => void }) => {
      res.redirect('/api/docs');
    });

  await app.init(); // init(), not listen(): Vercel owns the HTTP server
  return app;
}

// Cached so the app is built once per warm instance
let appPromise: Promise<NestExpressApplication> | null = null;

function getApp(): Promise<NestExpressApplication> {
  appPromise ??= createApp().catch((err) => {
    appPromise = null; // allow a retry on the next request
    throw err;
  });
  return appPromise;
}

// Vercel entry point
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const app = await getApp();
  const instance = app.getHttpAdapter().getInstance();
  return instance(req, res);
}

// Local / traditional hosting: keep the normal listen behaviour
void getApp().then(async (app) => {
  const configService = app.get(ConfigService);
  const isVercel = configService.get<boolean>('platform.isVercel') ?? false;
  if (!isVercel) {
    const logger = new Logger('DoriApi');
    const port = configService.get<number>('port') || 3000;
    await app.listen(port);
    logger.log(
      `OpenAPI documentation available at http://localhost:${port}/api/docs`,
    );
  }
});
