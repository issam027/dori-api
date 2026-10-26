import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { runMigrations } from './migration-runner';
import { safeErrorName } from '../logging/safe-error';

@Injectable()
export class DatabaseSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.dataSource.query('SET search_path TO dorify, pg_catalog');
    // Only run if DB is connected and enabled
    if (
      this.configService.get<boolean>(
        'databaseInitialization.autoRunMigrations',
      ) === true
    ) {
      await this.runMigrationsAndSeed();
    }
  }

  async runMigrationsAndSeed(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      this.logger.log('Executing database migrations and seed...');
      const migrationsPath = path.join(__dirname, 'sql', 'migrations');
      const seedPath = path.join(__dirname, 'sql', 'seed.sql');
      await runMigrations(
        {
          query: (sql, parameters) => queryRunner.query(sql, parameters),
          transaction: async (work) => {
            await queryRunner.startTransaction();
            try {
              const result = await work({
                query: (sql, parameters) => queryRunner.query(sql, parameters),
                transaction: () => {
                  throw new Error('Nested migrations are not supported.');
                },
              });
              await queryRunner.commitTransaction();
              return result;
            } catch (error) {
              await queryRunner.rollbackTransaction();
              throw error;
            }
          },
        },
        migrationsPath,
        (message) => this.logger.log(message),
      );

      if (fs.existsSync(seedPath)) {
        const seedSql = fs.readFileSync(seedPath, 'utf8');
        await queryRunner.query(seedSql);
        this.logger.log('Database seed executed successfully.');
      }
    } catch (err: unknown) {
      this.logger.error(`Schema/seed failed type=${safeErrorName(err)}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
