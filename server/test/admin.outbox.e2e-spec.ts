import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ValidationAuditFilter } from '../src/common/filters/validation-audit.filter';
import { AdminOutboxController } from '../src/modules/admin/outbox/admin-outbox.controller';
import { AdminOutboxService } from '../src/modules/admin/outbox/admin-outbox.service';

// supertest's typings are easiest to consume via require in this repo's TS config.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');

describe('AdminOutboxController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminOutboxController],
      providers: [
        {
          provide: AdminOutboxService,
          useValue: {
            listOutboxEvents: jest.fn().mockResolvedValue({ ok: true, events: [] }),
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

  it('rejects non-whitelisted query fields', async () => {
    await request(app.getHttpServer())
      .get('/admin/outbox')
      .query({ unexpectedField: 'nope' })
      .expect(400);
  });

  it('accepts known query fields', async () => {
    await request(app.getHttpServer())
      .get('/admin/outbox')
      .query({ limit: 10, topic: 'mm.started' })
      .expect(200);
  });
});
