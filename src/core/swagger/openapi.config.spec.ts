import { OpenAPIObject } from '@nestjs/swagger';
import { normalizeOpenApiDocument } from './openapi.config';

describe('normalizeOpenApiDocument', () => {
  it('centralizes id, time and endpoint-specific sort metadata', () => {
    const document = {
      openapi: '3.0.0',
      info: { title: 'test', version: '1' },
      paths: {
        '/persons': {
          get: {
            operationId: 'PersonsController_findPersons',
            responses: {},
            parameters: [
              { name: 'siteId', in: 'query', schema: { type: 'integer' } },
              { name: 'sort', in: 'query', schema: { type: 'string' } },
            ],
          },
        },
      },
      components: {
        schemas: {
          Item: {
            type: 'object',
            properties: {
              personId: { type: 'integer' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    } as OpenAPIObject;

    normalizeOpenApiDocument(document);
    const schema = document.components!.schemas!.Item as {
      properties: Record<string, { minimum?: number; format?: string }>;
    };
    expect(schema.properties.personId.minimum).toBe(1);
    expect(schema.properties.createdAt.format).toBe('date-time');
    const parameters = document.paths['/persons'].get!.parameters! as Array<{
      name: string;
      schema: { enum?: string[]; minimum?: number };
    }>;
    expect(
      parameters.find((item) => item.name === 'siteId')!.schema.minimum,
    ).toBe(1);
    expect(
      parameters.find((item) => item.name === 'sort')!.schema.enum,
    ).toContain('personId:asc');
  });

  it('removes inherited sort parameters when an endpoint does not sort', () => {
    const document = {
      openapi: '3.0.0',
      info: { title: 'test', version: '1' },
      paths: {
        '/threads': {
          get: {
            operationId: 'QueueEngineController_getThreads',
            responses: {},
            parameters: [
              { name: 'page', in: 'query', schema: { type: 'integer' } },
              { name: 'sort', in: 'query', schema: { type: 'string' } },
            ],
          },
        },
      },
    } as OpenAPIObject;
    normalizeOpenApiDocument(document);
    const parameters = document.paths['/threads'].get!.parameters! as Array<{
      name: string;
    }>;
    expect(parameters.map(({ name }) => name)).toEqual(['page']);
  });
});
