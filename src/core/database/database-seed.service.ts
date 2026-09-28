import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DatabaseSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap() {
    // Only run if DB is connected and enabled
    if (process.env.AUTO_RUN_MIGRATIONS === 'true') {
      await this.runSchemaAndSeed();
    }
  }

  async runSchemaAndSeed(): Promise<void> {
    try {
      this.logger.log('Executing database schema and seed...');
      const schemaPath = path.join(__dirname, 'sql', 'schema.sql');
      const seedPath = path.join(__dirname, 'sql', 'seed.sql');

      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await this.dataSource.query(schemaSql);
        this.logger.log('Database schema executed successfully.');
      }

      if (fs.existsSync(seedPath)) {
        const seedSql = fs.readFileSync(seedPath, 'utf8');
        await this.dataSource.query(seedSql);
        this.logger.log('Database seed executed successfully.');
      }
    } catch (err: any) {
      this.logger.error(`Error running schema/seed: ${err.message}`, err.stack);
    }
  }
}
