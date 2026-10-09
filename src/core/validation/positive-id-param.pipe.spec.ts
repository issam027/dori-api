import { BadRequestException } from '@nestjs/common';
import { PositiveIdParamPipe } from './positive-id-param.pipe';

describe('PositiveIdParamPipe', () => {
  const pipe = new PositiveIdParamPipe();
  const metadata = { type: 'param' as const, data: 'queueId' };

  it('parses a positive id', () => {
    expect(pipe.transform('12', metadata)).toBe(12);
  });

  it.each(['0', '-1', 'abc', '1.2'])('rejects invalid id %s', (value) => {
    expect(() => pipe.transform(value, metadata)).toThrow(BadRequestException);
  });

  it('does not alter non-id parameters', () => {
    expect(pipe.transform('twilio', { type: 'param', data: 'provider' })).toBe(
      'twilio',
    );
  });
});
