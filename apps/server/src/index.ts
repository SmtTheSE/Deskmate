import { createServer } from 'node:http';
import { writeFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { initKey, randomId } from './crypto.ts';
import { HttpError, makeCtx, send, serveStatic } from './http.ts';
import { buildRouter } from './routes.ts';
import { Service } from './service.ts';
import { Store } from './store.ts';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const DATA_DIR = resolve(process.env.DATA_DIR ?? join(here, '../../../data'));
const WEB_DIR = resolve(process.env.WEB_DIR ?? join(here, '../../web/dist'));
// Cloud hosts tell us our public address, so admins never have to type it.
const PUBLIC_URL = (
  process.env.PUBLIC_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '') ||
  (process.env.FLY_APP_NAME ? `https://${process.env.FLY_APP_NAME}.fly.dev` : '') ||
  `http://localhost:${PORT}`
).replace(/\/$/, '');
const ON_CLOUD = Boolean(process.env.RENDER || process.env.RAILWAY_ENVIRONMENT || process.env.FLY_APP_NAME);
const TRUST_PROXY = process.env.TRUST_PROXY ? process.env.TRUST_PROXY === 'true' : ON_CLOUD;

initKey(DATA_DIR, process.env.APP_SECRET);
const store = new Store(DATA_DIR, () => randomId(18));
const svc = new Service(store, PUBLIC_URL);

// A one-time code protects the setup wizard, so nobody else on the network can
// claim a fresh install. It is printed below and saved to data/setup-code.txt.
let setupCode: string | null = null;
const codeFile = join(DATA_DIR, 'setup-code.txt');
if (!store.configured) {
  const chosen = process.env.SETUP_CODE?.trim().toUpperCase();
  if (chosen && chosen.length < 8) console.warn('  SETUP_CODE is shorter than 8 characters, so a random code was generated instead.');
  setupCode = chosen && chosen.length >= 8 ? chosen : randomBytes(4).toString('hex').toUpperCase().replace(/(.{4})/, '$1-');
  writeFileSync(codeFile, `${setupCode}\n`);
}

const router = buildRouter(svc, {
  setupCode: () => (store.configured ? null : setupCode),
  secureCookies: PUBLIC_URL.startsWith('https://'),
});

const server = createServer(async (req, res) => {
  const ctx = makeCtx(req, res, TRUST_PROXY);
  const path = ctx.url.pathname;
  try {
    if (path.startsWith('/api/') || path.startsWith('/webhooks/')) {
      // Browsers cannot send JSON across sites without permission, so requiring it blocks CSRF.
      const mutating = req.method !== 'GET' && req.method !== 'HEAD';
      if (mutating && path.startsWith('/api/') && !String(req.headers['content-type'] ?? '').includes('application/json')) {
        throw new HttpError(415, 'Requests must be JSON.');
      }
      const m = router.match(req.method ?? 'GET', path);
      if (!m) throw new HttpError(404, 'Not found');
      ctx.params = m.params;
      const out: any = await m.handler(ctx);
      if (out && out.__download) return send(res, 200, JSON.stringify(out.data, null, 1), { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="${out.__download}"` });
      if (out && out.__twiml) return send(res, 200, '<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { 'content-type': 'text/xml' });
      if (store.configured && setupCode) {
        setupCode = null;
        rmSync(codeFile, { force: true });
      }
      return send(res, 200, out ?? { ok: true });
    }
    if (path === '/healthz') return send(res, 200, { ok: true });
    if (!serveStatic(WEB_DIR, ctx)) send(res, 404, 'The web app has not been built. Run "npm run build" or use the development server.');
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(e);
    send(res, status, { error: status === 500 ? 'Something went wrong on our side. Please try again.' : e.message });
  }
});

server.listen(PORT, process.env.HOST || undefined, () => {
  console.log(`\n  Deskmate is running at ${PUBLIC_URL}`);
  if (setupCode) {
    console.log(`\n  First time? Open this link to set up your help desk:\n\n    ${PUBLIC_URL}/setup?code=${setupCode}\n`);
  }
});

const shutdown = () => {
  store.flush();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
