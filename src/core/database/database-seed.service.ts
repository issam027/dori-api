import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { runMigrations } from './migration-runner';

@Injectable()
export class DatabaseSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
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
    try {
      this.logger.log('Executing database migrations and seed...');
      const migrationsPath = path.join(__dirname, 'sql', 'migrations');
      const seedPath = path.join(__dirname, 'sql', 'seed.sql');
      await runMigrations(
        {
          query: (sql, parameters) => this.dataSource.query(sql, parameters),
          transaction: (work) =>
            this.dataSource.transaction((manager) =>
              work({
                query: (sql, parameters) => manager.query(sql, parameters),
                transaction: () => {
                  throw new Error('Nested migrations are not supported.');
                },
              }),
            ),
        },
        migrationsPath,
        (message) => this.logger.log(message),
      );

      if (fs.existsSync(seedPath)) {
        const seedSql = fs.readFileSync(seedPath, 'utf8');
        await this.dataSource.query(seedSql);
        this.logger.log('Database seed executed successfully.');
      }
    } catch (err: any) {
      this.logger.error(`Error running schema/seed: ${err.message}`, err.stack);
      throw err;
    }
  }
}
