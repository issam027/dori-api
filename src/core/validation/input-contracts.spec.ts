import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ValidationPipe } from '@nestjs/common';
import { UpdateSiteDto } from '../../modules/sites/dto/update-site.dto';
import { RegistrationFilterDto } from '../../modules/registrations/dto/registration.dto';

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
});
