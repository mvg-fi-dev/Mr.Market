import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ValidationAuditFilter } from '../src/common/filters/validation-audit.filter';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import { MessageController } from '../src/modules/mixin/message/message.controller';
import { MessageService } from '../src/modules/mixin/message/message.service';

// supertest's typings are easiest to consume via require in this repo's TS config.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');

// Focused e2e to prove ValidationPipe(forbidNonWhitelisted) rejects extra fields
// on endpoints that accept request bodies.
//
// This uses a minimal module (no DB/queues/scheduler) so it stays fast and stable.

describe('Message validation (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MessageController],
      providers: [
        {
          provide: MessageService,
          useValue: {
            // Should never be called by the negative validation test.
            broadcastTextMessage: async () => ({ ok: true }),
            sendTextMessage: async () => ({ ok: true }),
            removeMessages: async () => ({ ok: true }),
            getAllMessages: async () => ({ ok: true }),
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

  it('rejects extra inbound fields on POST /mixin/message/broadcast', async () => {
    await request(app.getHttpServer())
      .post('/mixin/message/broadcast')
      .send({
        message: 'hello',
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
