import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { DataSource } from 'typeorm';

describe('AppModule (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('does not expose a root route', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });

  it('exposes the public health endpoint without infrastructure details', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/monitoring/health')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({ status: expect.any(String) }),
    );
    expect(response.body).not.toHaveProperty('database');
    expect(response.body).not.toHaveProperty('redis');
  });

  it.each([
    ['logout', 'post', '/api/v1/auth/logout'],
    ['registration creation', 'post', '/api/v1/registrations'],
    [
      'call next',
      'post',
      '/api/v1/queues/00000000-0000-4000-8000-000000000000/next',
    ],
  ])('rejects unauthenticated %s', async (_name, method, path) => {
    await request(app.getHttpServer())
      [method as 'post'](path)
      .send({})
      .expect(401);
  });

  it('resolves qualified application SQL to dorify even with a hostile search_path', async () => {
    const dataSource = app.get(DataSource);
    await dataSource.query('SET search_path TO public, pg_catalog');
    try {
      const rows = (await dataSource.query(
        'SELECT COUNT(*)::int AS total FROM dorify.dori_role',
      )) as Array<{ total: number }>;
      expect(rows[0].total).toBeGreaterThanOrEqual(5);
    } finally {
      await dataSource.query('SET search_path TO dorify, pg_catalog');
    }
  });
});
