/**
 * Standalone script to generate the OpenAPI YAML/JSON from the running NestJS app.
 * Usage: npm run swagger:export
 */
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { AppModule } from '../src/app.module';
import {
  createOpenApiConfig,
  normalizeOpenApiDocument,
} from '../src/core/swagger/openapi.config';

async function bootstrap() {
  process.env.SWAGGER_EXPORT = 'true';
  const app = await NestFactory.create(AppModule, { logger: ['error'] });

  const document = normalizeOpenApiDocument(
    SwaggerModule.createDocument(app, createOpenApiConfig()),
  );

  const jsonDocument = JSON.stringify(document, null, 2);
  writeFileSync('./openapi.json', jsonDocument, 'utf8');
  writeFileSync('./ai/docs-json.json', jsonDocument, 'utf8');
  console.log('✅  openapi.json generated');
  console.log('✅  ai/docs-json.json generated');

  try {
    const yamlStr = yaml.dump(document, { indent: 2, lineWidth: 120 });
    writeFileSync('./openapi.yaml', yamlStr, 'utf8');
    console.log('✅  openapi.yaml generated');
  } catch {
    console.log(
      '⚠️  js-yaml not installed; skipping YAML export. Run: npm install --save-dev js-yaml @types/js-yaml',
    );
  }

  await app.close();
}

bootstrap().catch(console.error);
