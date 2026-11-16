import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

/** A deliberately tiny HTTP layer: a router, JSON bodies, cookies, and static files. */

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: Record<string, string>;
  ip: string;
  body: () => Promise<any>;
  rawBody: () => Promise<string>;
  cookies: Record<string, string>;
}

export type Handler = (ctx: Ctx) => Promise<unknown> | unknown;

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class Router {
  private routes: { method: string; parts: string[]; handler: Handler }[] = [];

  on(method: string, path: string, handler: Handler) {
    this.routes.push({ method, parts: path.split('/').filter(Boolean), handler });
    return this;
  }
  get(p: string, h: Handler) { return this.on('GET', p, h); }
  post(p: string, h: Handler) { return this.on('POST', p, h); }
  put(p: string, h: Handler) { return this.on('PUT', p, h); }
  delete(p: string, h: Handler) { return this.on('DELETE', p, h); }

  match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
    const segs = pathname.split('/').filter(Boolean);
    for (const r of this.routes) {
      if (r.method !== method || r.parts.length !== segs.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < segs.length; i++) {
        const p = r.parts[i]!;
        if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(segs[i]!);
        else if (p !== segs[i]) { ok = false; break; }
      }
      if (ok) return { handler: r.handler, params };
    }
    return null;
  }
}

const MAX_BODY = 25 * 1024 * 1024;

export function makeCtx(req: IncomingMessage, res: ServerResponse, trustProxy: boolean): Ctx {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let raw: Promise<string> | null = null;
  const rawBody = () =>
    (raw ??= new Promise<string>((resolve, reject) => {
      let size = 0;
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => {
        size += c.length;
        if (size > MAX_BODY) {
          reject(new HttpError(413, 'That file is too large. The limit is 25 MB.'));
          req.destroy();
        } else chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    }));
  const cookies: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  const fwd = trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim() : '';
  return {
    req, res, url, params: {}, cookies, rawBody,
    ip: fwd || req.socket.remoteAddress || 'unknown',
    body: async () => {
      const text = await rawBody();
      if (!text) return {};
      const type = String(req.headers['content-type'] ?? '');
      if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text));
      try { return JSON.parse(text); } catch { throw new HttpError(400, 'Invalid JSON'); }
    },
  };
}

export function send(res: ServerResponse, status: number, data: unknown, headers: Record<string, string> = {}) {
  if (res.headersSent) return;
  const isText = typeof data === 'string';
  res.writeHead(status, {
    'content-type': isText ? (headers['content-type'] ?? 'text/plain; charset=utf-8') : 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(isText ? data : JSON.stringify(data));
}

/** Simple fixed-window limiter for public endpoints and sign-in. */
export function rateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (key: string) => {
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) {
      hits.set(key, { n: 1, reset: now + windowMs });
      return;
    }
    if (++h.n > limit) throw new HttpError(429, 'Too many requests. Please wait a minute and try again.');
  };
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json',
};

/** Serve the built web app, falling back to index.html for client-side routes. */
export function serveStatic(root: string, ctx: Ctx): boolean {
  if (!existsSync(root)) return false;
  const rel = normalize(decodeURIComponent(ctx.url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, rel);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
  if (!existsSync(file)) return false;
  const ext = extname(file);
  ctx.res.writeHead(200, {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': rel.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
  });
  createReadStream(file).pipe(ctx.res);
  return true;
}
