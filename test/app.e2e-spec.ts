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
