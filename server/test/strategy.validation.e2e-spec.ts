import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ValidationAuditFilter } from '../src/common/filters/validation-audit.filter';
import { AdminStrategyService } from '../src/modules/admin/strategy/adminStrategy.service';
import { StrategyController } from '../src/modules/market-making/strategy/strategy.controller';
import { StrategyService } from '../src/modules/market-making/strategy/strategy.service';

// supertest's typings are easiest to consume via require in this repo's TS config.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');

// Focused e2e to prove ValidationPipe(forbidNonWhitelisted) rejects extra fields
// on strategy endpoints that accept request bodies.
//
// This uses a minimal module (no DB/queues/scheduler) so it stays fast and stable.

describe('Strategy validation (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [StrategyController],
      providers: [
        {
          provide: StrategyService,
          useValue: {
            startArbitrageStrategyForUser: async () => ({ ok: true }),
            executePureMarketMakingStrategy: async () => ({ ok: true }),
            executeVolumeStrategy: async () => ({ ok: true }),
            stopStrategyForUser: async () => ({ ok: true }),
            stopVolumeStrategy: async () => ({ ok: true }),
            rerunStrategy: async () => ({ ok: true }),
            getRunningStrategies: async () => [],
            getAllStrategies: async () => [],
          },
        },
        {
          provide: AdminStrategyService,
          useValue: {
            joinStrategy: async () => ({ ok: true }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Mirror main.ts global validation.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Mirror main.ts audit filter.
    app.useGlobalFilters(new ValidationAuditFilter());

    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('rejects extra inbound fields on POST /strategy/execute-volume-strategy', async () => {
    await request(app.getHttpServer())
      .post('/strategy/execute-volume-strategy')
      .send({
        exchangeName: 'mexc',
        symbol: 'BTC/USDT',
        incrementPercentage: 0.1,
        intervalTime: 10,
        tradeAmount: 1,
        numTrades: 2,
        userId: 'u1',
        clientId: 'c1',
        pricePushRate: 0.5,
        unexpectedField: 'should-not-be-accepted',
      })
      .expect(400)
      .expect((res) => {
        if (!res.body || res.body.statusCode !== 400) {
          throw new Error('expected 400 response body');
        }
      });
  });

  it('rejects extra inbound fields on POST /strategy/execute-pure-market-making', async () => {
    await request(app.getHttpServer())
      .post('/strategy/execute-pure-market-making')
      .send({
        userId: 'u1',
        clientId: 'c1',
        pair: 'BTC/USDT',
        exchangeName: 'mexc',
        bidSpread: 0.1,
        askSpread: 0.1,
        orderAmount: 0.1,
        orderRefreshTime: 15_000,
        numberOfLayers: 1,
        priceSourceType: 'MID_PRICE',
        amountChangePerLayer: 1,
        amountChangeType: 'percentage',
        unexpectedField: 'should-not-be-accepted',
      })
      .expect(400)
      .expect((res) => {
        if (!res.body || res.body.statusCode !== 400) {
          throw new Error('expected 400 response body');
        }
      });
  });

  it('rejects extra inbound fields on POST /strategy/join', async () => {
    await request(app.getHttpServer())
      .post('/strategy/join')
      .send({
        userId: 'u1',
        clientId: 'c1',
        strategyKey: 'u1-c1-arbitrage',
        amount: 100,
        transactionHash: '0xabc123',
        tokenSymbol: 'USDT',
        chainId: 1,
        tokenAddress: '0xdef456',
        unexpectedField: 'should-not-be-accepted',
      })
      .expect(400)
      .expect((res) => {
        if (!res.body || res.body.statusCode !== 400) {
          throw new Error('expected 400 response body');
        }
      });
  });

  it('accepts a valid body on POST /strategy/join (200)', async () => {
    await request(app.getHttpServer())
      .post('/strategy/join')
      .send({
        userId: 'u1',
        clientId: 'c1',
        strategyKey: 'u1-c1-arbitrage',
        amount: 100,
        transactionHash: '0xabc123',
        tokenSymbol: 'USDT',
        chainId: 1,
        tokenAddress: '0xdef456',
      })
      .expect((res) => {
        if (res.statusCode !== 200) {
          throw new Error(
            `expected 200 OK but got ${res.statusCode}: ${JSON.stringify(res.body)}`,
          );
        }
      });
  });
});
