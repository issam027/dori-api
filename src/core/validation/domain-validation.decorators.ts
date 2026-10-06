import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

function validateObject(
  name: string,
  check: (value: Record<string, unknown>) => boolean,
  message: string,
  options?: ValidationOptions,
): ClassDecorator {
  return (target) =>
    registerDecorator({
      name,
      target: target as unknown as new (...args: never[]) => unknown,
      propertyName: '_domain',
      options: { message, ...options },
      validator: {
        validate: (_: unknown, args: ValidationArguments) =>
          check(args.object as Record<string, unknown>),
      },
    });
}

export const ExactlyOneOf = (
  fields: string[],
  options?: ValidationOptions,
): ClassDecorator =>
  validateObject(
    'exactlyOneOf',
    (value) => fields.filter((field) => value[field] != null).length === 1,
    `Exactly one of ${fields.join(', ')} must be provided`,
    options,
  );

export const ValidRegistrationSchedule = (
  options?: ValidationOptions,
): ClassDecorator =>
  validateObject(
    'validRegistrationSchedule',
    (value) =>
      value.entryType === 'appointment'
        ? value.scheduledTime != null
        : value.scheduledTime == null,
    'scheduledTime is required only for appointment registrations',
    options,
  );

export const ValidRegistrationLookup = (
  options?: ValidationOptions,
): ClassDecorator =>
  validateObject(
    'validRegistrationLookup',
    (value) =>
      value.ticketNumber != null ||
      (value.lastName != null && value.scheduledTime != null),
    'Provide ticketNumber or both lastName and scheduledTime',
    options,
  );

export const ValidSessionMode = (options?: ValidationOptions): ClassDecorator =>
  validateObject(
    'validSessionMode',
    (value) =>
      (value.mode ?? 'active') === 'active'
        ? value.threadNumber != null
        : value.threadNumber == null,
    'threadNumber is required in active mode and forbidden in consultation_only mode',
    options,
  );
