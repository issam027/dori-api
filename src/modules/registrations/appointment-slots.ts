import { DoriException } from '../../core/errors/dori.exception';

/** A timezone-free daily template; conversion to an instant remains in ClockService. */
export function appointmentSlotTimes(
  start: string,
  end: string,
  duration: number,
  breakStart?: string | null,
  breakEnd?: string | null,
): string[] {
  const minutes = (value: string) => {
    const [hours, mins] = value.split(':').map(Number);
    return hours * 60 + mins;
  };
  const first = minutes(start),
    last = minutes(end);
  if (
    !Number.isInteger(duration) ||
    duration <= 0 ||
    !Number.isFinite(first) ||
    !Number.isFinite(last)
  ) {
    throw new DoriException(
      'VALIDATION_ERROR',
      {},
      { errors: ['Invalid appointment slot configuration'] },
    );
  }
  const pauseStart = breakStart && breakEnd ? minutes(breakStart) : null;
  const pauseEnd = breakStart && breakEnd ? minutes(breakEnd) : null;
  const times: string[] = [];
  for (let current = first; current + duration <= last; current += duration) {
    if (
      pauseStart !== null &&
      pauseEnd !== null &&
      current < pauseEnd &&
      current + duration > pauseStart
    )
      continue;
    times.push(
      `${String(Math.floor(current / 60)).padStart(2, '0')}:${String(current % 60).padStart(2, '0')}:00`,
    );
  }
  return times;
}
