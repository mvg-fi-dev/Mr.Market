import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ValidationAuditFilter } from '../src/common/filters/validation-audit.filter';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import { ExchangeController } from '../src/modules/mixin/exchange/exchange.controller';
import { ExchangeService } from '../src/modules/mixin/exchange/exchange.service';

// supertest's typings are easiest to consume via require in this repo's TS config.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');

// Focused e2e for "no raw exchange secrets in HTTP bodies".
// Proves that ValidationPipe(forbidNonWhitelisted) rejects attempts to send
// api_key/api_secret or apiKey/apiSecret to the /exchange endpoints.
//
// This uses a minimal module (no DB/queues/scheduler) so it stays fast and stable.

describe('Sensitive payload validation (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ExchangeController],
      providers: [
        {
          provide: ExchangeService,
          useValue: {
            // Should never be called by the negative validation tests.
            getDepositAddressFromRequest: async () => ({ ok: true }),
            createWithdrawalFromRequest: async () => ({ ok: true }),
            getDepositsFromRequest: async () => ({ ok: true }),
            getAllSpotOrders: async () => ({ ok: true }),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

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

  it('rejects raw api_key/api_secret on /exchange/deposit/create', async () => {
    await request(app.getHttpServer())
      .post('/exchange/deposit/create')
      .send({
        exchange: 'mexc',
        symbol: 'BTC',
        network: 'BTC',
        api_key: 'should-not-be-accepted',
        api_secret: 'should-not-be-accepted',
      })
      .expect(400)
      .expect((res) => {
        if (!res.body || res.body.statusCode !== 400) {
          throw new Error('expected 400 response body');
        }
      });
  });

  it('rejects raw apiKey/apiSecret on /exchange/withdrawal/create', async () => {
    await request(app.getHttpServer())
      .post('/exchange/withdrawal/create')
      .send({
        exchange: 'mexc',
        symbol: 'BTC',
        network: 'BTC',
        address: 'bc1qexampleaddressxxxxxxxxxxxxxxxxxxxxxx',
        amount: '0.1',
        apiKey: 'should-not-be-accepted',
        apiSecret: 'should-not-be-accepted',
      })
      .expect(400)
      .expect((res) => {
        if (!res.body || res.body.statusCode !== 400) {
          throw new Error('expected 400 response body');
        }
      });
  });
});
