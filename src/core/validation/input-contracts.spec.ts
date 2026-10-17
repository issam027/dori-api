import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ValidationPipe } from '@nestjs/common';
import { UpdateSiteDto } from '../../modules/sites/dto/update-site.dto';
import {
  LookupRegistrationDto,
  RegistrationFilterDto,
} from '../../modules/registrations/dto/registration.dto';

describe('API input contracts', () => {
  it('rejects string booleans in JSON bodies when implicit conversion is disabled', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
    });

    await expect(
      pipe.transform(
        { isActive: 'false' },
        { type: 'body', metatype: UpdateSiteDto },
      ),
    ).rejects.toThrow();
  });

  it.each([
    'n/a',
    'booked',
    'checked_in',
    'rescheduled',
    'cancelled',
    'expired',
  ])(
    'accepts the persisted appointment status %s',
    async (appointmentStatus) => {
      const dto = plainToInstance(RegistrationFilterDto, {
        appointmentStatus,
      });

      expect(await validate(dto)).toHaveLength(0);
    },
  );

  it.each([
    { phoneNumber: '+21698765432' },
    { lastName: 'Ben Ali', scheduledTime: '2026-10-17T09:00:00Z' },
  ])('accepts a supported appointment lookup: %j', async (input) => {
    const dto = plainToInstance(LookupRegistrationDto, input);

    expect(await validate(dto)).toHaveLength(0);
  });

  it.each([
    {},
    { phoneNumber: '0612345678' },
    { lastName: 'Ben Ali' },
    {
      phoneNumber: '+21698765432',
      lastName: 'Ben Ali',
      scheduledTime: '2026-10-17T09:00:00Z',
    },
  ])('rejects an invalid appointment lookup: %j', async (input) => {
    const dto = plainToInstance(LookupRegistrationDto, input);

    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
