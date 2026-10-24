import { ConfigModule } from '@nestjs/config';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { CronModule } from './cron.module';

describe('CronModule', () => {
  it('imports ConfigModule for CronController ConfigService injection', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, CronModule) as
      unknown[] | undefined;

    expect(imports).toContain(ConfigModule);
  });
});
