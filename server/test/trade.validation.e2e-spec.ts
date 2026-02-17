import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ValidationAuditFilter } from '../src/common/filters/validation-audit.filter';
import { TradeController } from '../src/modules/market-making/trade/trade.controller';
import { TradeService } from '../src/modules/market-making/trade/trade.service';

// supertest's typings are easiest to consume via require in this repo's TS config.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');

// Focused e2e to prove ValidationPipe(forbidNonWhitelisted) rejects extra fields
// on non-admin endpoints that accept request bodies.
//
// This uses a minimal module (no DB/queues/scheduler) so it stays fast and stable.

describe('Trade validation (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TradeController],
      providers: [
        {
          provide: TradeService,
          useValue: {
            executeMarketTrade: async () => ({ ok: true }),
            executeLimitTrade: async () => ({ ok: true }),
            cancelOrder: async () => ({ ok: true }),
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

  it('rejects extra inbound fields on POST /trade/market', async () => {
    await request(app.getHttpServer())
      .post('/trade/market')
      .send({
        userId: 'u1',
        clientId: 'c1',
        exchange: 'mexc',
        symbol: 'BTC/USDT',
        side: 'buy',
        amount: 1,
        unexpectedField: 'should-not-be-accepted',
      })
      .expect(400)
      .expect((res) => {
        if (!res.body || res.body.statusCode !== 400) {
          throw new Error('expected 400 response body');
        }
      });
  });

  it('rejects extra inbound fields on POST /trade/limit', async () => {
    await request(app.getHttpServer())
      .post('/trade/limit')
      .send({
        userId: 'u1',
        clientId: 'c1',
        exchange: 'mexc',
        symbol: 'BTC/USDT',
        side: 'buy',
        amount: 1,
        price: 100,
        unexpectedField: 'should-not-be-accepted',
      })
      .expect(400)
      .expect((res) => {
        if (!res.body || res.body.statusCode !== 400) {
          throw new Error('expected 400 response body');
        }
      });
  });
});
