import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OpenQueueSessionDto } from './session.dto';

describe('OpenQueueSessionDto', () => {
  it('accepts and trims a complete counter name', async () => {
    const dto = plainToInstance(OpenQueueSessionDto, {
      threadNumber: 1,
      counterName: '  Cabinet 2  ',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.counterName).toBe('Cabinet 2');
  });

  it.each(['   ', 'A'.repeat(101)])(
    'rejects an invalid counter name: %s',
    async (counterName) => {
      const dto = plainToInstance(OpenQueueSessionDto, {
        threadNumber: 1,
        counterName,
      });

      expect(await validate(dto)).not.toHaveLength(0);
    },
  );
});
