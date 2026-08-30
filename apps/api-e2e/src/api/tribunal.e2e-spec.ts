import * as http from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
// eslint-disable-next-line @nx/enforce-module-boundaries -- e2e reuses the prod exception filter
import { AllExceptionsFilter } from '../../../api/src/common/all-exceptions.filter';

/**
 * In-process integration/e2e (SPEC §14.3). Boots the real AppModule against a
 * test Postgres (DATABASE_URL / E2E_DATABASE_URL — no Docker, per owner decision)
 * with a fake OpenRouter HTTP server. Requires a running Postgres.
 */

const FREE_MODELS = Array.from({ length: 7 }, (_, i) => ({
  id: `free-${i + 1}:free`,
  context_length: 128000 - i * 1000,
  pricing: { prompt: '0', completion: '0' },
}));

let mode: 'ok' | 'empty' = 'ok';
// When set, the fake OpenRouter returns a 403 "agentic harness only" for this
// model id, so the pipeline must skip it and retry on another free model.
let blockedModel: string | null = null;

function startFakeOpenRouter(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      if (req.url?.includes('/models')) {
        const data =
          mode === 'empty'
            ? [{ id: 'paid', context_length: 1, pricing: { prompt: '0.01', completion: '0.02' } }]
            : FREE_MODELS;
        res.end(JSON.stringify({ data }));
        return;
      }
      const requestedModel = (() => {
        try {
          return (JSON.parse(body) as { model?: string }).model ?? '';
        } catch {
          return '';
        }
      })();
      if (blockedModel && requestedModel === blockedModel) {
        res.statusCode = 403;
        res.end(
          JSON.stringify({
            error: {
              message: `${requestedModel} is only available on agentic harnesses`,
              code: 403,
            },
          }),
        );
        return;
      }
      const isJudge = body.includes('ADVOCATE ARGUMENTS');
      const content = isJudge
        ? 'As a judge I reason.\nDECISION: justified\nCONFIDENCE: 72'
        : 'A persuasive advocate speech.';
      res.end(
        JSON.stringify({
          choices: [{ message: { content } }],
          usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18, cost: 0 },
        }),
      );
    });
  });
  return new Promise((r) => server.listen(0, () => r(server)));
}

async function bootstrap(): Promise<INestApplication> {
  // Imported dynamically so process.env is set before ConfigModule validates it.
  // eslint-disable-next-line @nx/enforce-module-boundaries -- e2e boots its app under test
  const { AppModule } = await import('../../../api/src/app/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}

function login(app: INestApplication, username: string, password: string) {
  return request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ username, password });
}

/**
 * Runs execute asynchronously (SPEC §10.1): POST returns immediately with the
 * run in `running`. Poll the progress endpoint until a terminal status, then
 * return the final progress body (status + error).
 */
async function waitForRun(
  app: INestApplication,
  runId: string,
  tok: string,
  timeoutMs = 20000,
): Promise<{ status: string; error: string | null }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await request(app.getHttpServer())
      .get(`/api/runs/${runId}/progress`)
      .set({ Authorization: `Bearer ${tok}` });
    const status = res.body?.status as string | undefined;
    if (status && status !== 'running' && status !== 'pending') {
      return { status, error: res.body?.error ?? null };
    }
    if (Date.now() > deadline) {
      throw new Error(`run ${runId} did not finish (last status: ${status})`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

describe('Tribunal API (e2e)', () => {
  let server: http.Server;
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    server = await startFakeOpenRouter();
    const port = (server.address() as { port: number }).port;
    Object.assign(process.env, {
      DATABASE_URL:
        process.env.E2E_DATABASE_URL ??
        'postgres://postgres@127.0.0.1:5433/tribunal_e2e',
      OPENROUTER_API_KEY: 'sk-e2e',
      OPENROUTER_BASE_URL: `http://127.0.0.1:${port}`,
      JWT_SECRET: 'e2e-secret',
      JWT_EXPIRES_IN: '1d',
      SEED_USERNAME: 'admin',
      SEED_PASSWORD: 'pw',
      CORS_ORIGINS: 'http://localhost:4200',
      RUN_COST_CEILING_USD: '5',
    });
    app = await bootstrap();
    token = (await login(app, 'admin', 'pw')).body.accessToken;
  });

  afterAll(async () => {
    await app?.close();
    server?.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  describe('auth', () => {
    it('rejects bad credentials with 401', async () => {
      await login(app, 'admin', 'nope').expect(401);
    });
    it('returns the current user from a token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set(auth())
        .expect(200);
      expect(res.body.username).toBe('admin');
    });
    it('guards /runs without a token (401)', async () => {
      await request(app.getHttpServer()).get('/api/runs').expect(401);
    });
  });

  describe('charge sheet', () => {
    it('serves the seeded active charge sheet (T-001) with ISO dates', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/charge-sheet')
        .set(auth())
        .expect(200);
      expect(res.body.title).toContain('T-001');
      expect(typeof res.body.createdAt).toBe('string');
      expect(res.body.content.length).toBeGreaterThan(0);
    });
  });

  describe('personas roster', () => {
    it('serves 7 personas with names and roles, without leaking systemPrompt', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/personas')
        .set(auth())
        .expect(200);
      expect(res.body).toHaveLength(7);
      const advocates = res.body.filter((p: { role: string }) => p.role === 'advocate');
      const judges = res.body.filter((p: { role: string }) => p.role === 'judge');
      expect(advocates).toHaveLength(4);
      expect(judges).toHaveLength(3);
      for (const p of res.body) {
        expect(typeof p.name).toBe('string');
        expect(p.name.length).toBeGreaterThan(0);
        expect(p.systemPrompt).toBeUndefined();
      }
    });
  });

  describe('full run (Mode A)', () => {
    let runId: string;

    it('runs the tribunal and returns a runId', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/runs')
        .set(auth())
        .send({ mode: 'A_single' })
        .expect(201);
      runId = res.body.runId;
      expect(runId).toBeTruthy();
    });

    it('returns 4 speeches + 3 verdicts + economy + non-binding tally', async () => {
      await waitForRun(app, runId, token);
      const res = await request(app.getHttpServer())
        .get(`/api/runs/${runId}`)
        .set(auth())
        .expect(200);
      expect(res.body.status).toBe('completed');
      expect(res.body.speeches).toHaveLength(4);
      expect(res.body.verdicts).toHaveLength(3);
      expect(res.body.economy.perPersona).toHaveLength(7);
      expect(res.body.economy.perPersona[0].personaName).toBeTruthy();
      expect(res.body.verdictTally.justified + res.body.verdictTally.not_justified).toBe(3);
      // No combined/authoritative verdict field.
      expect(res.body.finalDecision).toBeUndefined();
      expect(res.body.verdicts[0].reasoning.length).toBeGreaterThan(0);
      // Persona display names are resolved on the DTOs (SPEC §5.6/§11).
      expect(typeof res.body.speeches[0].personaName).toBe('string');
      expect(res.body.speeches[0].personaName.length).toBeGreaterThan(0);
      expect(typeof res.body.verdicts[0].personaName).toBe('string');
    });

    it('wrote the per-run economy JSON file and the ledger', async () => {
      expect(existsSync(resolve(process.cwd(), 'apps/api/data/runs', `${runId}.json`))).toBe(true);
      const ledger = await request(app.getHttpServer())
        .get('/api/economy/ledger')
        .set(auth())
        .expect(200);
      expect(ledger.body.some((e: { runId: string }) => e.runId === runId)).toBe(true);
    });

    it('lists the run in history', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/runs?limit=10')
        .set(auth())
        .expect(200);
      expect(res.body.some((r: { id: string }) => r.id === runId)).toBe(true);
    });
  });

  describe('full run (Mode B)', () => {
    it('assigns 7 distinct models across the personas', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/runs')
        .set(auth())
        .send({ mode: 'B_per_persona' })
        .expect(201);
      await waitForRun(app, created.body.runId, token);
      const res = await request(app.getHttpServer())
        .get(`/api/runs/${created.body.runId}`)
        .set(auth())
        .expect(200);
      const models = [
        ...res.body.speeches.map((s: { model: string }) => s.model),
        ...res.body.verdicts.map((v: { model: string }) => v.model),
      ];
      expect(new Set(models).size).toBe(7);
    });
  });

  describe('failure surfaces', () => {
    let app2: INestApplication;
    let token2: string;

    beforeAll(async () => {
      mode = 'empty'; // fake OpenRouter now exposes no free models
      app2 = await bootstrap(); // fresh ModelsService cache
      token2 = (await login(app2, 'admin', 'pw')).body.accessToken;
    });

    afterAll(async () => {
      await app2?.close();
      mode = 'ok';
    });

    it('records the data-policy failure on the run with an actionable message (SPEC §10.1)', async () => {
      const created = await request(app2.getHttpServer())
        .post('/api/runs')
        .set({ Authorization: `Bearer ${token2}` })
        .send({ mode: 'A_single' })
        .expect(201);
      const final = await waitForRun(app2, created.body.runId, token2);
      expect(final.status).toBe('failed');
      expect(String(final.error)).toMatch(/free model|privacy/i);
    });
  });

  describe('restricted-model fallback', () => {
    let app3: INestApplication;
    let token3: string;

    beforeAll(async () => {
      blockedModel = 'free-1:free'; // the top free model Mode A auto-picks
      app3 = await bootstrap();
      token3 = (await login(app3, 'admin', 'pw')).body.accessToken;
    });

    afterAll(async () => {
      await app3?.close();
      blockedModel = null;
    });

    it('skips a 403 "agentic harness only" model and completes on another free model', async () => {
      const created = await request(app3.getHttpServer())
        .post('/api/runs')
        .set({ Authorization: `Bearer ${token3}` })
        .send({ mode: 'A_single' })
        .expect(201);
      await waitForRun(app3, created.body.runId, token3);
      const res = await request(app3.getHttpServer())
        .get(`/api/runs/${created.body.runId}`)
        .set({ Authorization: `Bearer ${token3}` })
        .expect(200);
      expect(res.body.status).toBe('completed');
      expect(res.body.speeches).toHaveLength(4);
      expect(res.body.verdicts).toHaveLength(3);
      const models = [...res.body.speeches, ...res.body.verdicts].map(
        (x: { model: string }) => x.model,
      );
      expect(models).not.toContain('free-1:free');
    });
  });
});
