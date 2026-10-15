import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NotificationFilterDto } from '../../notifications/dto/notification.dto';
import {
  RegistrationAvailabilityQueryDto,
  RegistrationFilterDto,
} from './registration.dto';

describe('Phase 2 temporal filters', () => {
  it.each([RegistrationFilterDto, NotificationFilterDto])(
    '%p accepts a complete range and rejects a single bound',
    async (Dto) => {
      const DtoClass = Dto as new () => object;
      const valid = plainToInstance(DtoClass, {
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
      });
      expect(await validate(valid)).toHaveLength(0);

      const invalid = plainToInstance(DtoClass, { dateFrom: '2026-10-01' });
      expect(await validate(invalid)).not.toHaveLength(0);
    },
  );

  it('transforms availability summaryOnly and validates the required range', async () => {
    const dto = plainToInstance(RegistrationAvailabilityQueryDto, {
      dateFrom: '2026-10-01',
      dateTo: '2026-10-02',
      summaryOnly: 'true',
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.summaryOnly).toBe(true);
  });

  it('rejects ranges longer than 366 days', async () => {
    const dto = plainToInstance(NotificationFilterDto, {
      dateFrom: '2026-01-01',
      dateTo: '2027-01-02',
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
