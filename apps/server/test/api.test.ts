import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// End-to-end API test: setup wizard → public form → AI draft → human approval → audit log.

const PORT = 3900 + Math.floor(Math.random() * 90);
const base = `http://localhost:${PORT}`;
const dataDir = mkdtempSync(join(tmpdir(), 'deskmate-test-'));
let server: ChildProcess;
let cookie = '';

async function call(path: string, body?: unknown, method = body ? 'POST' : 'GET') {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0]!;
  return { status: res.status, data: (await res.json()) as any };
}

before(async () => {
  server = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings', 'src/index.ts'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, WEB_DIR: join(dataDir, 'none') },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${base}/healthz`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});

after(() => {
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
});

test('setup requires the one-time code', async () => {
  const r = await call('/api/setup/complete', { setupCode: 'WRONG', org: { name: 'X' } });
  assert.equal(r.status, 403);
});

test('full flow: setup, ticket, draft, approve', async () => {
  const setupCode = readFileSync(join(dataDir, 'setup-code.txt'), 'utf8').trim();
  const setup = await call('/api/setup/complete', {
    setupCode,
    org: { name: 'Test School', template: 'school' },
    admin: { name: 'Admin', email: 'admin@test.org', password: 'long enough password' },
    model: { provider: 'mock' },
    starterDocs: true,
  });
  assert.equal(setup.status, 200, JSON.stringify(setup.data));

  const sub = await call('/api/public/tickets', { name: 'Pat', email: 'pat@test.org', message: 'I forgot my password and cannot log in to my account' });
  assert.equal(sub.status, 200);

  let t: any;
  for (let i = 0; i < 30; i++) {
    t = (await call(`/api/tickets/${sub.data.ref}`)).data;
    if (t.status !== 'processing') break;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.equal(t.status, 'needs_review');
  assert.equal(t.departmentId, 'it');
  assert.ok(t.draft.grounded);

  const sent = await call(`/api/tickets/${t.id}/send`, { body: t.draft.body, fromDraft: true });
  assert.equal(sent.status, 200);
  const after = (await call(`/api/tickets/${t.id}`)).data;
  assert.equal(after.status, 'replied');
  assert.equal(after.messages.at(-1).aiDrafted, true);
  assert.equal(after.messages.at(-1).edited, false);

  const audit = (await call(`/api/audit?ticket=${t.ref}`)).data;
  assert.ok(audit.some((a: any) => a.action === 'reply_sent'));

  // The requester can see the reply on their status page.
  const status = await fetch(`${base}${sub.data.statusUrl.replace('/help/status/', '/api/public/tickets/')}`).then((r) => r.json());
  assert.equal(status.status, 'answered');
});

test('API rejects non-JSON writes (CSRF protection) and anonymous access', async () => {
  const r = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' });
  assert.equal(r.status, 415);
  const anon = await fetch(`${base}/api/tickets`);
  assert.equal(anon.status, 401);
});
