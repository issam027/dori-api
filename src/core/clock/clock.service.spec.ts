import { ClockService } from './clock.service';

describe('ClockService', () => {
  const clock = new ClockService();

  it.each([
    ['Europe/Berlin', '2026-03-29', '2026-03-29T21:59:59.999Z'],
    ['Europe/Berlin', '2026-10-25', '2026-10-25T22:59:59.999Z'],
    ['America/New_York', '2026-03-08', '2026-03-09T03:59:59.999Z'],
    ['Africa/Tunis', '2026-06-15', '2026-06-15T22:59:59.999Z'],
  ])('converts end of day in %s across DST', (timezone, date, expected) => {
    expect(clock.endOfBusinessDay(date, timezone).toISOString()).toBe(expected);
  });

  it('centralizes parsing and additions', () => {
    const start = clock.parse('2026-01-01T00:00:00.000Z');
    expect(clock.addMinutes(start, 15).toISOString()).toBe(
      '2026-01-01T00:15:00.000Z',
    );
    expect(clock.addDays(start, 1).toISOString()).toBe(
      '2026-01-02T00:00:00.000Z',
    );
  });

  it('interprets offset-less appointment times in the site timezone', () => {
    expect(
      clock
        .parseInTimezone('2026-07-01T10:00:00', 'Europe/Berlin')
        .toISOString(),
    ).toBe('2026-07-01T08:00:00.000Z');
    expect(
      clock
        .parseInTimezone('2026-07-01T10:00:00Z', 'Europe/Berlin')
        .toISOString(),
    ).toBe('2026-07-01T10:00:00.000Z');
  });
});
