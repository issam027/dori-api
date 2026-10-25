import { ConfiguredIoAdapter } from './configured-io.adapter';
import { INestApplicationContext } from '@nestjs/common';
import * as redisAdapterModule from '@socket.io/redis-adapter';

jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: jest.fn().mockReturnValue(jest.fn()),
}));

describe('ConfiguredIoAdapter', () => {
  let appMock: INestApplicationContext;
  let redisMock: {
    status: string;
    duplicate: jest.Mock;
  };
  let subMock: {
    on: jest.Mock;
  };

  beforeEach(() => {
    appMock = {} as INestApplicationContext;
    subMock = {
      on: jest.fn(),
    };
    redisMock = {
      status: 'ready',
      duplicate: jest.fn().mockReturnValue(subMock),
    };
    jest.clearAllMocks();
  });

  it('configures Redis adapter when Redis is ready', () => {
    const adapter = new ConfiguredIoAdapter(
      appMock,
      ['http://localhost:3000'],
      redisMock as never,
    );

    expect(redisMock.duplicate).toHaveBeenCalled();
    expect(subMock.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(redisAdapterModule.createAdapter).toHaveBeenCalledWith(
      redisMock,
      subMock,
      { key: 'dori:socket.io' },
    );
    expect(adapter).toBeDefined();
  });

  it('falls back to default adapter when Redis is null or disabled', () => {
    const adapter = new ConfiguredIoAdapter(appMock, ['http://localhost:3000'], null);

    expect(redisMock.duplicate).not.toHaveBeenCalled();
    expect(redisAdapterModule.createAdapter).not.toHaveBeenCalled();
    expect(adapter).toBeDefined();
  });
});
