import { ConfigModule } from '@nestjs/config';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { AppModule } from '../app.module';
import { CronModule } from './cron.module';

describe('CronModule', () => {
  it('imports ConfigModule for CronController ConfigService injection', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, CronModule) as
      unknown[] | undefined;

    expect(imports).toContain(ConfigModule);
  });

  it('is always registered so its operations are present in Swagger', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) as
      unknown[] | undefined;

    expect(imports).toContain(CronModule);
  });
});
