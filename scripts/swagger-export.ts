/**
 * Standalone script to generate the OpenAPI YAML/JSON from the running NestJS app.
 * Usage: npm run swagger:export
 */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { AppModule } from '../src/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('Dori API')
    .setDescription(
      "Spécification de référence de la plateforme de gestion de files d'attente et de rendez-vous Dori",
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: "Entrez votre token JWT d'accès",
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

  const document = SwaggerModule.createDocument(app, config);

  writeFileSync('./openapi.json', JSON.stringify(document, null, 2), 'utf8');
  console.log('✅  openapi.json generated');

  try {
    const yamlStr = yaml.dump(document, { indent: 2, lineWidth: 120 });
    writeFileSync('./openapi.yaml', yamlStr, 'utf8');
    console.log('✅  openapi.yaml generated');
  } catch {
    console.log('⚠️  js-yaml not installed; skipping YAML export. Run: npm install --save-dev js-yaml @types/js-yaml');
  }

  await app.close();
}

bootstrap().catch(console.error);
