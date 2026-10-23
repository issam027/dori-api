import { BadRequestException } from '@nestjs/common';
import { InternalUuidParamPipe } from './internal-uuid-param.pipe';

describe('InternalUuidParamPipe', () => {
  const pipe = new InternalUuidParamPipe();
  const metadata = { type: 'param' as const, data: 'queueId' };

  it('accepts and normalizes an internal UUID', () => {
    const value = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
    expect(pipe.transform(value, metadata)).toBe(value.toLowerCase());
  });

  it.each(['0', '-1', 'abc', '1.2'])('rejects invalid UUID %s', (value) => {
    expect(() => pipe.transform(value, metadata)).toThrow(BadRequestException);
  });

  it('preserves opaque audit event UUIDs for ParseUUIDPipe', () => {
    const eventId = '4c2c3b9b-eaf3-40fe-aa96-14d407ccc6e5';
    expect(pipe.transform(eventId, { type: 'param', data: 'eventId' })).toBe(
      eventId,
    );
  });

  it('does not alter non-id parameters', () => {
    expect(pipe.transform('twilio', { type: 'param', data: 'provider' })).toBe(
      'twilio',
    );
  });
});
