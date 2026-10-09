import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto, SetUserPasswordDto } from './user.dto';

describe('User DTOs Password Validation', () => {
  it('accepts a valid password between 10 and 20 characters', async () => {
    const dto = plainToInstance(CreateUserDto, {
      username: 'hostesse',
      email: 'hostesse@hopital.tn',
      password: 'Root@123456',
      userType: 'human',
      languagePreference: 'fr',
      roleId: 2,
    });

    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'password')).toHaveLength(0);
  });

  it('rejects passwords shorter than 10 characters', async () => {
    const dto = plainToInstance(CreateUserDto, {
      username: 'hostesse',
      email: 'hostesse@hopital.tn',
      password: 'Short123', // 8 characters
      userType: 'human',
      languagePreference: 'fr',
      roleId: 2,
    });

    const errors = await validate(dto);
    const passwordError = errors.find((e) => e.property === 'password');
    expect(passwordError).toBeDefined();
    expect(passwordError?.constraints).toHaveProperty('minLength');
  });

  it('rejects passwords longer than 20 characters', async () => {
    const dto = plainToInstance(CreateUserDto, {
      username: 'hostesse',
      email: 'hostesse@hopital.tn',
      password: 'ThisPasswordIsWayTooLongAndExceedsTwentyChars!', // > 20 characters
      userType: 'human',
      languagePreference: 'fr',
      roleId: 2,
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
});
