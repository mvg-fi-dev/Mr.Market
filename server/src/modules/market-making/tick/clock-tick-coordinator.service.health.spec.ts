import { ConfigService } from '@nestjs/config';

import { ClockTickCoordinatorService } from './clock-tick-coordinator.service';

describe('ClockTickCoordinatorService (health signals)', () => {
  const createService = () => {
    const configService = {
      get: jest.fn((_key: string, defaultValue?: number) => defaultValue),
    } as unknown as ConfigService;

    return new ClockTickCoordinatorService(configService);
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('updates lastTickAtMs/lastTickAt and increments tickCount after successful tick', async () => {
    const service = createService();

    service.register(
      'component',
      {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn().mockResolvedValue(undefined),
        health: jest.fn().mockResolvedValue(true),
        onTick: jest.fn().mockResolvedValue(undefined),
      },
      10,
    );

    expect(service.getTickCount()).toBe(0);
    expect(service.getLastTickAt()).toBeNull();
    expect(service.getLastTickAtMs()).toBeNull();

    await service.tickOnce();

    expect(service.getTickCount()).toBe(1);
    expect(typeof service.getLastTickAt()).toBe('string');
    expect(typeof service.getLastTickAtMs()).toBe('number');
    expect((service.getLastTickAtMs() as number) > 0).toBe(true);
  });
});
