import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from '../src/app.controller';

// supertest's typings are easiest to consume via require in this repo's TS config.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');

// Keep this e2e test minimal and dependency-free (no DB, no Redis, no auth boot).

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: () => undefined,
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('/ (GET) returns server info bundle', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => {
        if (!res.body || typeof res.body !== 'object') {
          throw new Error('expected JSON response body');
        }
        if (!('timestamp' in res.body)) {
          throw new Error('expected timestamp in response');
        }
      });
  });
});
