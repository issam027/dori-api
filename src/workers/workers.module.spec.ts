import { ConfigModule } from '@nestjs/config';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { WorkersModule } from './workers.module';

describe('WorkersModule', () => {
  it('imports ConfigModule for workers that inject ConfigService', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      WorkersModule,
    ) as unknown[];

    expect(imports).toContain(ConfigModule);
  });
});
