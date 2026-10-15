import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  DATE_RANGE_LIMITS,
  DateRangeQueryDto,
  ValidDateRange,
  inclusiveCalendarDayCount,
} from './date-range.dto';

@ValidDateRange(DATE_RANGE_LIMITS.availabilityDetailedDays)
class AvailabilityRangeDto extends DateRangeQueryDto {}

describe('DateRangeQueryDto', () => {
  it.each([
    ['2026-09-01', '2026-09-01'],
    ['2024-02-29', '2024-03-01'],
    ['2026-01-01', '2027-01-01'],
  ])('accepts an inclusive range from %s to %s', async (dateFrom, dateTo) => {
    const dto = plainToInstance(DateRangeQueryDto, { dateFrom, dateTo });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([
    [{ dateTo: '2026-09-30' }, 'dateFrom'],
    [{ dateFrom: '2026-09-01' }, 'dateTo'],
    [{ dateFrom: '2026-9-01', dateTo: '2026-09-30' }, 'dateFrom'],
    [{ dateFrom: '2026-02-30', dateTo: '2026-03-01' }, 'dateFrom'],
    [{ dateFrom: '2026-09-01T00:00:00Z', dateTo: '2026-09-30' }, 'dateFrom'],
  ])('rejects an invalid payload %p', async (payload, invalidProperty) => {
    const dto = plainToInstance(DateRangeQueryDto, payload);
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === invalidProperty)).toBe(
      true,
    );
  });

  it('rejects an inverted range', async () => {
    const dto = plainToInstance(DateRangeQueryDto, {
      dateFrom: '2026-10-01',
      dateTo: '2026-09-30',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === '_dateRange')).toBe(true);
  });

  it('rejects a range longer than the synchronous limit', async () => {
    const dto = plainToInstance(DateRangeQueryDto, {
      dateFrom: '2026-01-01',
      dateTo: '2027-01-02',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === '_dateRange')).toBe(true);
  });

  it('supports a stricter endpoint-specific limit', async () => {
    const dto = plainToInstance(AvailabilityRangeDto, {
      dateFrom: '2026-01-01',
      dateTo: '2026-03-04',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === '_dateRange')).toBe(true);
  });

  it('counts inclusive calendar days independently of a timezone', () => {
    expect(inclusiveCalendarDayCount('2026-03-29', '2026-03-29')).toBe(1);
    expect(inclusiveCalendarDayCount('2026-03-29', '2026-03-30')).toBe(2);
    expect(inclusiveCalendarDayCount('2026-03-30', '2026-03-29')).toBeNull();
    expect(DATE_RANGE_LIMITS.availabilityDetailedDays).toBe(62);
  });
});
