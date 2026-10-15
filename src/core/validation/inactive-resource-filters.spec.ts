import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SiteFilterDto } from '../../modules/sites/dto/update-site.dto';
import { QueueFilterDto } from '../../modules/queues/dto/update-queue.dto';
import { RegistrationFilterDto } from '../../modules/registrations/dto/registration.dto';
import {
  PersonFilterDto,
  PersonNoteFilterDto,
} from '../../modules/persons/dto/person.dto';
import { UserFilterDto } from '../../modules/users/dto/user.dto';
import {
  TranslationBundleQueryDto,
  TranslationFilterDto,
} from '../../modules/translations/dto/translation.dto';

describe('inactive resource filters', () => {
  const cases: Array<[new () => object, Record<string, unknown>]> = [
    [SiteFilterDto, {}],
    [QueueFilterDto, {}],
    [RegistrationFilterDto, {}],
    [PersonFilterDto, { siteId: 1 }],
    [PersonNoteFilterDto, {}],
    [UserFilterDto, {}],
    [TranslationFilterDto, {}],
    [TranslationBundleQueryDto, { locale: 'fr' }],
  ];

  it.each(cases)('%p preserves isActive=false', async (Dto, base) => {
    const dto = plainToInstance(
      Dto,
      { ...base, isActive: 'false' },
      { enableImplicitConversion: true },
    ) as { isActive?: boolean };
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.isActive).toBe(false);
  });

  it.each(cases)('%p rejects non-boolean query values', async (Dto, base) => {
    const dto = plainToInstance(
      Dto,
      { ...base, isActive: 'all' },
      { enableImplicitConversion: true },
    );
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
