import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ValidationAuditFilter } from '../src/common/filters/validation-audit.filter';
import { UserOrdersController } from '../src/modules/market-making/user-orders/user-orders.controller';
import { UserOrdersService } from '../src/modules/market-making/user-orders/user-orders.service';

// supertest's typings are easiest to consume via require in this repo's TS config.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');

// Focused e2e to prove ValidationPipe(forbidNonWhitelisted) rejects extra fields
// on non-admin endpoints that accept request bodies.
//
// Uses a minimal module (no DB/queues/scheduler) so it stays fast and stable.

describe('UserOrders validation (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UserOrdersController],
      providers: [
        {
          provide: UserOrdersService,
          useValue: {
            // Should never be called by the negative validation test.
            createMarketMakingOrderIntent: async () => ({ ok: true }),

            // Unused controller deps kept as no-ops for module wiring.
            findAllStrategyByUser: async () => ({ ok: true }),
            findMarketMakingPaymentStateById: async () => ({ ok: true }),
            findSimplyGrowByUserId: async () => ({ ok: true }),
            findSimplyGrowByOrderId: async () => ({ ok: true }),
            findMarketMakingByUserId: async () => ({ ok: true }),
            findMarketMakingByOrderId: async () => ({ ok: true }),
            getUserOrders: async () => ({ ok: true }),
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

  it('rejects extra inbound fields on POST /user-orders/market-making/intent', async () => {
    await request(app.getHttpServer())
      .post('/user-orders/market-making/intent')
      .send({
        marketMakingPairId: 'pair-1',
        userId: 'u1',
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
