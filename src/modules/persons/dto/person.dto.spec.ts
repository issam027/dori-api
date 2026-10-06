import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreatePersonDto,
  PersonIdentityDto,
  UpdatePersonDto,
} from './person.dto';
import { CreateRegistrationDto } from '../../registrations/dto/registration.dto';

describe('person identity validation', () => {
  it.each([
    [{ lastName: 'Ben Ali' }, 'phoneNumber'],
    [{ phoneNumber: '+21698765432' }, 'lastName'],
    [{ lastName: '', phoneNumber: '+21698765432' }, 'lastName'],
  ])('rejects an incomplete identity %#', async (value, property) => {
    const dto = plainToInstance(PersonIdentityDto, value);
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === property)).toBe(true);
  });

  it('accepts a non-empty last name and an E.164 phone number', async () => {
    const dto = plainToInstance(PersonIdentityDto, {
      lastName: 'Ben Ali',
      phoneNumber: '+21698765432',
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('applies the identity invariant to direct creation', async () => {
    const dto = plainToInstance(CreatePersonDto, {
      siteId: 1,
      lastName: 'Ben Ali',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'phoneNumber')).toBe(true);
  });

  it('applies the identity invariant to embedded registration creation', async () => {
    const dto = plainToInstance(CreateRegistrationDto, {
      person: { firstName: 'Nadia' },
      queueId: 1,
      entryType: 'walkin',
      tierId: 1,
    });
    const errors = await validate(dto);
    const personError = errors.find((error) => error.property === 'person');
    expect(personError?.children?.map((child) => child.property)).toEqual(
      expect.arrayContaining(['lastName', 'phoneNumber']),
    );
  });

  it('keeps person updates partial', async () => {
    const dto = plainToInstance(UpdatePersonDto, { firstName: 'Nadia' });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
