import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ValidationAuditFilter } from '../src/common/filters/validation-audit.filter';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import { AdminController } from '../src/modules/admin/admin.controller';
import { AdminGrowService } from '../src/modules/admin/growdata/adminGrow.service';
import { AdminSpotService } from '../src/modules/admin/admin-spot-management/admin-spot-management.service';
import { AdminStrategyService } from '../src/modules/admin/strategy/adminStrategy.service';

// supertest's typings are easiest to consume via require in this repo's TS config.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');

// Focused e2e to prove ValidationPipe(forbidNonWhitelisted) rejects extra fields
// on admin endpoints that accept request bodies.
//
// This uses a minimal module (no DB/queues/scheduler) so it stays fast and stable.

describe('Admin validation (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminStrategyService,
          useValue: {
            startStrategy: async () => ({ ok: true }),
            stopStrategy: async () => ({ ok: true }),
            getDepositAddress: async () => ({ ok: true }),
            getSupportedNetworks: async () => ({ ok: true }),
            getChainInfo: async () => ({ ok: true }),
            getTokenSymbolByContract: async () => ({ ok: true }),
            verifyContribution: async () => ({ ok: true }),
            getRunningStrategies: async () => ({ ok: true }),
            getSupportedExchanges: async () => ({ ok: true }),
            getAllCcxtExchanges: async () => ({ ok: true }),
            getCcxtExchangeDetails: async () => ({ ok: true }),
            getCcxtExchangeMarkets: async () => ({ ok: true }),
          },
        },
        {
          provide: AdminGrowService,
          useValue: {
            addExchange: async () => ({ ok: true }),
            removeExchange: async () => ({ ok: true }),
            removeAllExchanges: async () => ({ ok: true }),
            updateExchange: async () => ({ ok: true }),
            addSimplyGrowToken: async () => ({ ok: true }),
            removeSimplyGrowToken: async () => ({ ok: true }),
            removeAllSimplyGrowTokens: async () => ({ ok: true }),
            updateSimplyGrowToken: async () => ({ ok: true }),
            addMarketMakingPair: async () => ({ ok: true }),
            removeMarketMakingPair: async () => ({ ok: true }),
            removeAllMarketMakingPairs: async () => ({ ok: true }),
            updateMarketMakingPair: async () => ({ ok: true }),
            addArbitragePair: async () => ({ ok: true }),
            removeArbitragePair: async () => ({ ok: true }),
            removeAllArbitragePairs: async () => ({ ok: true }),
            updateArbitragePair: async () => ({ ok: true }),
          },
        },
        {
          provide: AdminSpotService,
          useValue: {
            addTradingPair: async () => ({ ok: true }),
            removeTradingPair: async () => ({ ok: true }),
            removeAllTradingPairs: async () => ({ ok: true }),
            updateTradingPair: async () => ({ ok: true }),
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

  it('rejects extra inbound fields on POST /admin/grow/exchange/add', async () => {
    await request(app.getHttpServer())
      .post('/admin/grow/exchange/add')
      .send({
        exchange_id: 'binance',
        name: 'Binance',
        icon_url: '',
        enable: true,
        api_secret: 'should-not-be-accepted',
      })
      .expect(400)
      .expect((res) => {
        if (!res.body || res.body.statusCode !== 400) {
          throw new Error('expected 400 response body');
        }
      });
  });

  it('rejects extra inbound fields on POST /admin/spot/trading-pair/add', async () => {
    await request(app.getHttpServer())
      .post('/admin/spot/trading-pair/add')
      .send({
        id: '123e4567-e89b-12d3-a456-426614174000',
        ccxt_id: 'binance',
        symbol: 'BTC/USDT',
        exchange_id: 'binance',
        amount_significant_figures: '8',
        price_significant_figures: '2',
        buy_decimal_digits: '2',
        sell_decimal_digits: '2',
        max_buy_amount: '1000',
        max_sell_amount: '1000',
        base_asset_id: '7e04727a-6f8b-499a-92d0-18bf4ef013bb',
        quote_asset_id: 'ccde90fe-d611-4fc8-afb4-3388e96fbb02',
        custom_fee_rate: '0.001',
        enable: true,
        apiKeyId: 'should-not-be-accepted',
      })
      .expect(400)
      .expect((res) => {
        if (!res.body || res.body.statusCode !== 400) {
          throw new Error('expected 400 response body');
        }
      });
  });

  it('rejects extra inbound fields on POST /admin/grow/simply-grow/add', async () => {
    await request(app.getHttpServer())
      .post('/admin/grow/simply-grow/add')
      .send({
        asset_id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'SimplyGrow Token',
        symbol: 'SGT',
        icon_url: '',
        apy: '0.12',
        enable: true,
        apiKeyId: 'should-not-be-accepted',
      })
      .expect(400)
      .expect((res) => {
        if (!res.body || res.body.statusCode !== 400) {
          throw new Error('expected 400 response body');
        }
      });
  });

  it('rejects extra inbound fields on POST /admin/grow/exchange/update/:exchange_id', async () => {
    await request(app.getHttpServer())
      .post('/admin/grow/exchange/update/binance')
      .send({
        name: 'Binance',
        enable: true,
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
