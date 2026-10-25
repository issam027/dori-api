import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto, SetUserPasswordDto, UserFilterDto } from './user.dto';

describe('User DTOs Password Validation', () => {
  it('accepts a valid password between 10 and 20 characters', async () => {
    const dto = plainToInstance(CreateUserDto, {
      username: 'operator',
      email: 'operator@hopital.tn',
      password: 'Root@123456',
      userType: 'human',
      languagePreference: 'fr',
      roleId: '00000000-0000-4000-8000-000000000002',
    });

    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'password')).toHaveLength(0);
  });

  it('rejects passwords shorter than 10 characters', async () => {
    const dto = plainToInstance(CreateUserDto, {
      username: 'operator',
      email: 'operator@hopital.tn',
      password: 'Short123', // 8 characters
      userType: 'human',
      languagePreference: 'fr',
      roleId: '00000000-0000-4000-8000-000000000002',
    });

    const errors = await validate(dto);
    const passwordError = errors.find((e) => e.property === 'password');
    expect(passwordError).toBeDefined();
    expect(passwordError?.constraints).toHaveProperty('minLength');
  });

  it('rejects passwords longer than 20 characters', async () => {
    const dto = plainToInstance(CreateUserDto, {
      username: 'operator',
      email: 'operator@hopital.tn',
      password: 'ThisPasswordIsWayTooLongAndExceedsTwentyChars!', // > 20 characters
      userType: 'human',
      languagePreference: 'fr',
      roleId: '00000000-0000-4000-8000-000000000002',
    });

    const errors = await validate(dto);
    const passwordError = errors.find((e) => e.property === 'password');
    expect(passwordError).toBeDefined();
    expect(passwordError?.constraints).toHaveProperty('maxLength');
  });

  it('validates SetUserPasswordDto with 10 to 20 characters', async () => {
    const validDto = plainToInstance(SetUserPasswordDto, {
      newPassword: 'Root@123456',
    });
    expect(await validate(validDto)).toHaveLength(0);

    const tooLongDto = plainToInstance(SetUserPasswordDto, {
      newPassword: 'ThisPasswordIsWayTooLongAndExceedsTwentyChars!',
    });
    const errors = await validate(tooLongDto);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });

  it('accepts only a boolean mustChangePassword flag when provided', async () => {
    const validDto = plainToInstance(SetUserPasswordDto, {
      newPassword: 'Root@123456',
      mustChangePassword: true,
    });
    expect(await validate(validDto)).toHaveLength(0);

    const invalidDto = plainToInstance(SetUserPasswordDto, {
      newPassword: 'Root@123456',
      mustChangePassword: 'true',
    });
    const errors = await validate(invalidDto);
    expect(
      errors.find((error) => error.property === 'mustChangePassword'),
    ).toBeDefined();
  });
});

describe('UserFilterDto', () => {
  it('accepts siteIds as a CSV string', async () => {
    const dto = plainToInstance(UserFilterDto, {
      siteIds:
        '00000000-0000-4000-8000-000000000007,00000000-0000-4000-8000-000000000008',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.siteIds).toBe(
      '00000000-0000-4000-8000-000000000007,00000000-0000-4000-8000-000000000008',
    );
  });

  it.each(['', '7,nope', '0,7', '-1,7', ['7', '8']])(
    'rejects invalid siteIds %p',
    async (siteIds) => {
      const dto = plainToInstance(UserFilterDto, { siteIds });

      expect((await validate(dto)).length).toBeGreaterThan(0);
    },
  );
});
