import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ValidationAuditFilter } from '../src/common/filters/validation-audit.filter';
import { LocalCampaignController } from '../src/modules/market-making/local-campaign/local-campaign.controller';
import { LocalCampaignService } from '../src/modules/market-making/local-campaign/local-campaign.service';

// supertest's typings are easiest to consume via require in this repo's TS config.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');

// Focused e2e to prove ValidationPipe(forbidNonWhitelisted) rejects extra fields
// on non-admin endpoints that accept request bodies.
//
// Uses a minimal module (no DB/queues/scheduler) so it stays fast and stable.

describe('LocalCampaign validation (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [LocalCampaignController],
      providers: [
        {
          provide: LocalCampaignService,
          useValue: {
            // Should never be called by the negative validation test.
            createCampaign: async () => ({ ok: true }),
            findById: async () => ({ ok: true }),
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

  it('rejects extra inbound fields on POST /local-campaigns', async () => {
    await request(app.getHttpServer())
      .post('/local-campaigns')
      .send({
        name: 'Test Campaign',
        pair: 'BTC/USDT',
        exchange: 'mexc',
        rewardToken: 'USDT',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 60_000).toISOString(),
        totalReward: 1,
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
