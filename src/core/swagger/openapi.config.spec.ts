import { OpenAPIObject } from '@nestjs/swagger';
import { ParameterObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
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
      properties: Record<string, { type?: string; format?: string }>;
    };
    expect(schema.properties.personId).toMatchObject({
      type: 'string',
      format: 'uuid',
    });
    expect(schema.properties.createdAt.format).toBe('date-time');
    const parameters = document.paths['/persons'].get!.parameters! as Array<{
      name: string;
      schema: { enum?: string[]; type?: string; format?: string };
    }>;
    expect(
      parameters.find((item) => item.name === 'siteId')!.schema,
    ).toMatchObject({ type: 'string', format: 'uuid' });
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

  it('documents scalar and referenced properties and calendar query formats', () => {
    const document = {
      openapi: '3.0.0',
      info: { title: 'test', version: '1' },
      paths: {
        '/registrations': {
          get: {
            operationId: 'RegistrationsController_findRegistrations',
            description: 'Recherche.',
            responses: {},
            parameters: [
              { name: 'dateFrom', in: 'query', schema: { type: 'string' } },
              { name: 'dateTo', in: 'query', schema: { type: 'string' } },
            ],
          },
        },
      },
      components: {
        schemas: {
          Child: { type: 'object', properties: { value: { type: 'string' } } },
          Parent: {
            type: 'object',
            properties: {
              child: { $ref: '#/components/schemas/Child' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    } as OpenAPIObject;

    normalizeOpenApiDocument(document);

    const parent = document.components!.schemas!.Parent as {
      properties: Record<string, { description?: string; allOf?: unknown[] }>;
    };
    expect(parent.properties.child.description).toBeTruthy();
    expect(parent.properties.child.allOf).toHaveLength(1);
    expect(parent.properties.createdAt.description).toBeTruthy();
    const parameters = document.paths['/registrations'].get!
      .parameters! as ParameterObject[];
    for (const parameter of parameters) {
      expect(parameter.description).toBeTruthy();
      expect(parameter.schema).toMatchObject({
        type: 'string',
        format: 'date',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      });
    }
  });

  it('removes inherited bearer security and irrelevant errors from public operations', () => {
    const document = {
      openapi: '3.0.0',
      info: { title: 'test', version: '1' },
      paths: {
        '/webhook': {
          post: {
            operationId: 'NotificationsController_handleWebhook',
            security: [{ bearer: [] }],
            responses: {
              '200': { description: 'ok' },
              '401': { description: 'unauthenticated' },
              '403': { description: 'forbidden' },
            },
          },
        },
      },
      components: { schemas: {} },
    } as OpenAPIObject;

    normalizeOpenApiDocument(document);

    const operation = document.paths['/webhook'].post!;
    expect(operation.security).toEqual([]);
    expect(operation.responses['401']).toBeDefined();
    expect(operation.responses['403']).toBeUndefined();
  });
});
