import { createModel, getTemplate, MODEL_CHOICES, TEMPLATES } from '@deskmate/core';
import type { Department, ModelProvider, OrgProfile, TemplateId } from '@deskmate/core';
import { hashPassword, randomId, safeEqual, verifyPassword } from './crypto.ts';
import { testEmail, testTwilio, validTwilioSignature } from './channels.ts';
import { HttpError, rateLimiter, Router } from './http.ts';
import type { Ctx } from './http.ts';
import type { Service } from './service.ts';
import type { Ticket, User } from './store.ts';

const SESSION_COOKIE = 'dm_session';
const SESSION_DAYS = 14;

export function buildRouter(svc: Service, opts: { setupCode: () => string | null; secureCookies: boolean }) {
  const r = new Router();
  const db = () => svc.db;
  const loginLimit = rateLimiter(10, 60_000);
  const publicLimit = rateLimiter(20, 60_000);

  // ---------- helpers ----------
  const currentUser = (ctx: Ctx): User | null => {
    const sid = ctx.cookies[SESSION_COOKIE];
    if (!sid) return null;
    const s = db().sessions.find((x) => x.id === sid && Date.parse(x.expiresAt) > Date.now());
    return s ? db().users.find((u) => u.id === s.userId) ?? null : null;
  };
  const requireUser = (ctx: Ctx) => {
    const u = currentUser(ctx);
    if (!u) throw new HttpError(401, 'Please sign in.');
    return u;
  };
  const requireAdmin = (ctx: Ctx) => {
    const u = requireUser(ctx);
    if (u.role !== 'admin') throw new HttpError(403, 'Only admins can change settings.');
    return u;
  };
  /** During first-time setup, the one-time setup code stands in for a login. */
  const requireSetupOrAdmin = (ctx: Ctx, body: any) => {
    if (!svc.store.configured) {
      const code = opts.setupCode();
      if (!code || typeof body?.setupCode !== 'string' || !safeEqual(body.setupCode.trim().toUpperCase(), code)) throw new HttpError(403, 'The setup code is missing or wrong.');
      return 'setup';
    }
    return requireAdmin(ctx).email;
  };
  const startSession = (ctx: Ctx, user: User) => {
    const id = randomId(24);
    db().sessions = db().sessions.filter((s) => Date.parse(s.expiresAt) > Date.now());
    db().sessions.push({ id, userId: user.id, expiresAt: new Date(Date.now() + SESSION_DAYS * 864e5).toISOString() });
    ctx.res.setHeader('set-cookie', `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${opts.secureCookies ? '; Secure' : ''}`);
    svc.store.save();
  };
  const publicUser = (u: User) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
  const getTicket = (id: string) => {
    const t = db().tickets.find((x) => x.id === id || x.ref === id);
    if (!t) throw new HttpError(404, 'That conversation was not found.');
    return t;
  };
  const str = (v: unknown, max = 5000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  // ---------- status & setup ----------
  r.get('/api/status', () => ({
    configured: svc.store.configured,
    org: db().org ? { name: db().org!.name, departments: db().org!.departments.map((d) => ({ id: d.id, name: d.name, description: d.description })) } : null,
  }));

  r.get('/api/setup/options', () => ({
    templates: TEMPLATES.map((t) => ({ id: t.id, title: t.title, blurb: t.blurb, departments: t.departments, starterDocs: t.starterDocs.map((d) => d.title) })),
    models: MODEL_CHOICES,
    inboundEmailPath: '/webhooks/email',
  }));

  r.post('/api/setup/check-code', async (ctx) => {
    const body = await ctx.body();
    if (svc.store.configured) throw new HttpError(409, 'This help desk is already set up. Please sign in.');
    loginLimit(`setup:${ctx.ip}`);
    requireSetupOrAdmin(ctx, body);
    return { ok: true };
  });

  r.post('/api/setup/test/:kind', async (ctx) => {
    const body = await ctx.body();
    requireSetupOrAdmin(ctx, body);
    const kind = ctx.params.kind;
    if (kind === 'model') {
      const provider = body.provider as ModelProvider;
      // An empty key means "use the one already saved".
      const apiKey = str(body.apiKey) || (provider === db().settings.model.provider ? svc.getSecret('modelApiKey') : undefined);
      return createModel({ provider, model: str(body.model) || undefined, baseUrl: str(body.baseUrl) || undefined, apiKey }).test();
    }
    if (kind === 'email') return testEmail({ ...body, smtpPass: str(body.smtpPass) || svc.getSecret('smtpPass') });
    if (kind === 'twilio') return testTwilio({ ...body, authToken: str(body.authToken) || svc.getSecret('twilioAuthToken') });
    throw new HttpError(404, 'Unknown test');
  });

  r.post('/api/setup/complete', async (ctx) => {
    const body = await ctx.body();
    if (svc.store.configured) throw new HttpError(409, 'This help desk is already set up.');
    requireSetupOrAdmin(ctx, body);
    const admin = body.admin ?? {};
    if (!str(admin.name) || !/^\S+@\S+\.\S+$/.test(str(admin.email))) throw new HttpError(400, 'Please enter your name and a valid email address.');
    if (str(admin.password).length < 10) throw new HttpError(400, 'Please choose a password with at least 10 characters.');
    const orgName = str(body.org?.name, 120);
    if (!orgName) throw new HttpError(400, 'Please enter your organization\'s name.');
    const template = getTemplate((body.org?.template as TemplateId) ?? 'blank');
    const departments = cleanDepartments(body.org?.departments) ?? template.departments;

    db().org = { name: orgName, template: template.id, departments, signature: str(body.org?.signature, 120) || `The ${orgName} team` };
    applySettings(body);
    const user: User = { id: randomId(), name: str(admin.name, 120), email: str(admin.email, 200).toLowerCase(), passwordHash: hashPassword(str(admin.password, 200)), role: 'admin', createdAt: new Date().toISOString() };
    db().users.push(user);
    if (body.starterDocs) for (const d of template.starterDocs) svc.addKnowledge(d.title, `${d.title}.txt`, d.text, 'setup');
    db().setupCompletedAt = new Date().toISOString();
    svc.audit(user.email, 'setup_completed', `Set up "${orgName}" using the ${template.title} template.`);
    svc.store.flush();
    startSession(ctx, user);
    return { ok: true, user: publicUser(user) };
  });

  function cleanDepartments(input: unknown): Department[] | null {
    if (!Array.isArray(input) || !input.length) return null;
    const used = new Set<string>();
    return input.slice(0, 30).map((d: any) => {
      let id = str(d.id, 40) || str(d.name, 40).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || randomId(4);
      while (used.has(id)) id += '-2';
      used.add(id);
      return {
        id,
        name: str(d.name, 60) || 'Untitled',
        description: str(d.description, 200),
        keywords: Array.isArray(d.keywords) ? d.keywords.map((k: unknown) => str(k, 40)).filter(Boolean).slice(0, 40) : [],
        mode: d.mode === 'auto' ? 'auto' : 'approval',
      };
    });
  }

  function applySettings(body: any) {
    const s = db().settings;
    if (body.model) {
      const provider: ModelProvider = ['mock', 'openai', 'anthropic', 'ollama'].includes(body.model.provider) ? body.model.provider : 'mock';
      if (provider !== s.model.provider && !str(body.model.apiKey)) svc.setSecret('modelApiKey', '');
      s.model = { provider, model: str(body.model.model, 100) || undefined, baseUrl: str(body.model.baseUrl, 300) || undefined };
      if (str(body.model.apiKey)) svc.setSecret('modelApiKey', str(body.model.apiKey, 500));
    }
    if (body.email) {
      const e = body.email;
      s.email = { ...s.email, enabled: Boolean(e.enabled), smtpHost: str(e.smtpHost, 200) || undefined, smtpPort: Number(e.smtpPort) || undefined, smtpUser: str(e.smtpUser, 200) || undefined, fromAddress: str(e.fromAddress, 200) || undefined };
      if (str(e.smtpPass)) svc.setSecret('smtpPass', str(e.smtpPass, 500));
    }
    if (body.twilio) {
      const t = body.twilio;
      s.twilio = { enabled: Boolean(t.enabled), accountSid: str(t.accountSid, 100) || undefined, smsNumber: str(t.smsNumber, 30) || undefined, whatsappNumber: str(t.whatsappNumber, 40) || undefined };
      if (str(t.authToken)) svc.setSecret('twilioAuthToken', str(t.authToken, 200));
    }
    if (body.policy) {
      s.policy = {
        sensitivePhrases: Array.isArray(body.policy.sensitivePhrases) ? body.policy.sensitivePhrases.map((p: unknown) => str(p, 80)).filter(Boolean) : s.policy.sensitivePhrases,
        autoSendMinConfidence: Math.min(0.99, Math.max(0.5, Number(body.policy.autoSendMinConfidence) || s.policy.autoSendMinConfidence)),
      };
    }
  }

  // ---------- auth ----------
  r.post('/api/auth/login', async (ctx) => {
    loginLimit(`login:${ctx.ip}`);
    const body = await ctx.body();
    const u = db().users.find((x) => x.email === str(body.email).toLowerCase());
    if (!u || !verifyPassword(str(body.password), u.passwordHash)) throw new HttpError(401, 'That email and password do not match.');
    startSession(ctx, u);
    svc.audit(u.email, 'signed_in', 'Signed in.');
    return { user: publicUser(u) };
  });
  r.post('/api/auth/logout', (ctx) => {
    const sid = ctx.cookies[SESSION_COOKIE];
    db().sessions = db().sessions.filter((s) => s.id !== sid);
    ctx.res.setHeader('set-cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    svc.store.save();
    return { ok: true };
  });
  r.get('/api/auth/me', (ctx) => ({ user: currentUser(ctx) ? publicUser(currentUser(ctx)!) : null }));

  // ---------- team ----------
  r.get('/api/users', (ctx) => { requireAdmin(ctx); return db().users.map(publicUser); });
  r.post('/api/users', async (ctx) => {
    const admin = requireAdmin(ctx);
    const b = await ctx.body();
    const email = str(b.email, 200).toLowerCase();
    if (!str(b.name) || !/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Please enter a name and a valid email.');
    if (db().users.some((u) => u.email === email)) throw new HttpError(409, 'Someone with that email already has an account.');
    const tempPassword = randomId(9);
    const u: User = { id: randomId(), name: str(b.name, 120), email, passwordHash: hashPassword(tempPassword), role: b.role === 'admin' ? 'admin' : 'staff', createdAt: new Date().toISOString() };
    db().users.push(u);
    svc.audit(admin.email, 'user_added', `Added ${u.name} (${u.role}).`);
    return { user: publicUser(u), tempPassword };
  });

  // ---------- tickets ----------
  const summary = (t: Ticket) => ({
    id: t.id, ref: t.ref, channel: t.channel, subject: t.subject, status: t.status, urgency: t.urgency, departmentId: t.departmentId,
    category: t.category, summary: t.summary, requester: t.requester, createdAt: t.createdAt, updatedAt: t.updatedAt,
    flagged: t.safety.flagged, hasDraft: Boolean(t.draft), messageCount: t.messages.length,
  });

  r.get('/api/tickets', (ctx) => {
    requireUser(ctx);
    const status = ctx.url.searchParams.get('status');
    const q = (ctx.url.searchParams.get('q') ?? '').toLowerCase();
    const dep = ctx.url.searchParams.get('department');
    let list = db().tickets;
    if (status === 'open') list = list.filter((t) => t.status !== 'closed' && t.status !== 'replied');
    else if (status) list = list.filter((t) => t.status === status);
    if (dep) list = list.filter((t) => t.departmentId === dep);
    if (q) list = list.filter((t) => `${t.ref} ${t.subject} ${t.summary} ${t.requester.name ?? ''} ${t.requester.email ?? ''}`.toLowerCase().includes(q));
    return list.slice(0, 500).map(summary);
  });

  r.get('/api/tickets/:id', (ctx) => {
    requireUser(ctx);
    const { accessKey: _hidden, ...t } = getTicket(ctx.params.id!);
    return t;
  });

  r.post('/api/tickets/:id/send', async (ctx) => {
    const u = requireUser(ctx);
    const t = getTicket(ctx.params.id!);
    const b = await ctx.body();
    const body = str(b.body, 10000);
    if (!body) throw new HttpError(400, 'The reply is empty.');
    const aiDrafted = Boolean(t.draft) && b.fromDraft === true;
    const edited = aiDrafted && body.trim() !== t.draft!.body.trim();
    const { msg } = await svc.sendReply(t, body, u.email, { aiDrafted, edited });
    return { ok: true, message: msg };
  });

  r.post('/api/tickets/:id/regenerate', async (ctx) => {
    const u = requireUser(ctx);
    const t = getTicket(ctx.params.id!);
    t.status = 'processing';
    svc.audit(u.email, 'draft_requested', 'Asked for a new draft.', t.ref);
    await svc.process(t);
    return { ok: true };
  });

  r.post('/api/tickets/:id/update', async (ctx) => {
    const u = requireUser(ctx);
    const t = getTicket(ctx.params.id!);
    const b = await ctx.body();
    const changes: string[] = [];
    if (b.departmentId && db().org?.departments.some((d) => d.id === b.departmentId) && b.departmentId !== t.departmentId) {
      t.departmentId = b.departmentId;
      changes.push(`moved to ${db().org!.departments.find((d) => d.id === b.departmentId)!.name}`);
    }
    if (['low', 'normal', 'high', 'urgent'].includes(b.urgency) && b.urgency !== t.urgency) { t.urgency = b.urgency; changes.push(`urgency set to ${b.urgency}`); }
    if (['needs_review', 'needs_person', 'replied', 'closed'].includes(b.status) && b.status !== t.status) { t.status = b.status; changes.push(b.status === 'closed' ? 'closed' : `marked ${b.status.replace('_', ' ')}`); }
    if (b.discardDraft) { t.draft = null; if (t.status === 'needs_review') t.status = 'needs_person'; changes.push('discarded the AI draft'); }
    t.updatedAt = new Date().toISOString();
    if (changes.length) svc.audit(u.email, 'ticket_updated', changes.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.', t.ref);
    return { ok: true };
  });

  r.get('/api/stats', (ctx) => { requireUser(ctx); return svc.stats(); });
  r.get('/api/audit', (ctx) => {
    requireUser(ctx);
    const ref = ctx.url.searchParams.get('ticket');
    return (ref ? db().audit.filter((a) => a.ticketRef === ref) : db().audit).slice(0, 300);
  });

  // ---------- knowledge ----------
  r.get('/api/knowledge', (ctx) => {
    requireUser(ctx);
    return db().knowledge.map((d) => ({ id: d.id, title: d.title, filename: d.filename, createdAt: d.createdAt, chars: d.chars, sections: d.chunks.length }));
  });
  r.post('/api/knowledge', async (ctx) => {
    const u = requireUser(ctx);
    const b = await ctx.body();
    const filename = str(b.filename, 200) || 'document.txt';
    let text = typeof b.text === 'string' ? b.text : '';
    if (b.base64) {
      const buf = Buffer.from(String(b.base64), 'base64');
      if (/\.pdf$/i.test(filename)) {
        const { extractText, getDocumentProxy } = await import('unpdf');
        const pdf = await getDocumentProxy(new Uint8Array(buf));
        const out = await extractText(pdf, { mergePages: false });
        text = (out.text as string[]).join('\n\n');
      } else text = buf.toString('utf8');
    }
    if (!/\.(txt|md|markdown|html?|csv|pdf)$/i.test(filename) && !b.text) throw new HttpError(400, 'This file type is not supported yet. Please upload PDF, Word saved as PDF, text, Markdown, or web pages.');
    if (text.trim().length < 20) throw new HttpError(400, 'We could not find readable text in that file. If it is a scanned PDF, it needs text recognition first.');
    const title = str(b.title, 160) || filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    const doc = svc.addKnowledge(title, filename, text, u.email);
    return { id: doc.id, title: doc.title, sections: doc.chunks.length };
  });
  r.delete('/api/knowledge/:id', (ctx) => { const u = requireUser(ctx); svc.removeKnowledge(ctx.params.id!, u.email); return { ok: true }; });
  r.post('/api/knowledge/search', async (ctx) => {
    requireUser(ctx);
    const b = await ctx.body();
    return svc.knowledgeIndex().search(str(b.q, 500), 5).map((h) => ({ title: h.docTitle, text: h.chunk.text, score: Number(h.score.toFixed(2)) }));
  });

  // ---------- settings ----------
  r.get('/api/settings', (ctx) => {
    requireAdmin(ctx);
    const s = db().settings;
    return {
      org: db().org,
      model: { ...s.model, hasKey: Boolean(db().secrets.modelApiKey) },
      email: { ...s.email, hasPassword: Boolean(db().secrets.smtpPass) },
      twilio: { ...s.twilio, hasToken: Boolean(db().secrets.twilioAuthToken) },
      policy: s.policy,
      webhooks: {
        email: `${svc.publicUrl}/webhooks/email?token=${s.email.inboundToken}`,
        twilio: `${svc.publicUrl}/webhooks/twilio`,
        helpForm: `${svc.publicUrl}/help`,
      },
    };
  });
  r.put('/api/settings', async (ctx) => {
    const u = requireAdmin(ctx);
    const b = await ctx.body();
    if (b.org && db().org) {
      const org: OrgProfile = db().org!;
      if (str(b.org.name)) org.name = str(b.org.name, 120);
      if (str(b.org.signature)) org.signature = str(b.org.signature, 120);
      const deps = cleanDepartments(b.org.departments);
      if (deps) org.departments = deps;
    }
    applySettings(b);
    svc.audit(u.email, 'settings_changed', `Changed settings: ${Object.keys(b).join(', ')}.`);
    return { ok: true };
  });

  // ---------- public help form ----------
  r.post('/api/public/tickets', async (ctx) => {
    if (!svc.store.configured) throw new HttpError(503, 'This help desk is not set up yet.');
    publicLimit(`public:${ctx.ip}`);
    const b = await ctx.body();
    if (str(b.website)) return { ok: true, ref: 'HD-0' }; // honeypot field for bots
    const message = str(b.message, 8000);
    if (message.length < 5) throw new HttpError(400, 'Please describe what you need help with.');
    const email = str(b.email, 200);
    if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'That email address does not look right.');
    const t = await svc.receive({ channel: 'web', requester: { name: str(b.name, 120) || undefined, email: email || undefined }, subject: str(b.subject, 160), text: message, departmentId: str(b.departmentId, 40) || undefined });
    return { ok: true, ref: t.ref, statusUrl: `/help/status/${t.ref}?key=${t.accessKey}` };
  });

  const publicTicket = (ctx: Ctx) => {
    const t = db().tickets.find((x) => x.ref === ctx.params.ref);
    const key = ctx.url.searchParams.get('key') ?? '';
    if (!t || !safeEqual(key, t.accessKey)) throw new HttpError(404, 'We could not find that request. Check the link you were given.');
    return t;
  };
  r.get('/api/public/tickets/:ref', (ctx) => {
    publicLimit(`status:${ctx.ip}`);
    const t = publicTicket(ctx);
    return {
      ref: t.ref, subject: t.subject, createdAt: t.createdAt, orgName: db().org?.name,
      status: t.status === 'replied' ? 'answered' : t.status === 'closed' ? 'closed' : 'open',
      messages: t.messages.map((m) => ({ direction: m.direction, body: m.body, at: m.at })),
    };
  });
  r.post('/api/public/tickets/:ref/reply', async (ctx) => {
    publicLimit(`public:${ctx.ip}`);
    const t = publicTicket(ctx);
    const b = await ctx.body();
    const text = str(b.message, 8000);
    if (!text) throw new HttpError(400, 'The message is empty.');
    if (t.status === 'closed') t.status = 'processing';
    await svc.receive({ channel: t.channel, requester: t.requester, text, existing: t });
    return { ok: true };
  });

  // ---------- inbound webhooks ----------
  // Email: any provider that can POST JSON for incoming mail (Postmark, Mailgun routes, SendGrid Inbound Parse via a small adapter, or n8n).
  r.post('/webhooks/email', async (ctx) => {
    const token = ctx.url.searchParams.get('token') ?? '';
    if (!safeEqual(token, db().settings.email.inboundToken)) throw new HttpError(403, 'Bad token');
    const b = await ctx.body();
    const fromRaw = str(b.from ?? b.From ?? b.sender, 300);
    const email = (fromRaw.match(/[^\s<>"]+@[^\s<>"]+/) ?? [''])[0].toLowerCase();
    const name = fromRaw.replace(/<.*>/, '').replace(/"/g, '').trim() || undefined;
    const subject = str(b.subject ?? b.Subject, 200);
    const text = stripQuoted(str(b.text ?? b.TextBody ?? b['body-plain'] ?? b.plain, 20000));
    if (!email || !text) throw new HttpError(400, 'Missing sender or text');
    const ref = subject.match(/\[(HD-\d+)\]/)?.[1];
    const existing = ref ? svc.findOpenTicket((t) => t.ref === ref && t.requester.email === email) : undefined;
    const t = await svc.receive({ channel: 'email', requester: { name, email }, subject: subject.replace(/^(re|fwd?):\s*/i, '').replace(/\s*\[HD-\d+\]/, ''), text, existing });
    return { ok: true, ref: t.ref };
  });

  // Twilio: SMS and WhatsApp use the same webhook. Configure it as the "A message comes in" URL.
  r.post('/webhooks/twilio', async (ctx) => {
    const params = (await ctx.body()) as Record<string, string>;
    const token = svc.getSecret('twilioAuthToken');
    if (token) {
      const url = `${svc.publicUrl}${ctx.url.pathname}${ctx.url.search}`;
      if (!(await validTwilioSignature(token, url, params, String(ctx.req.headers['x-twilio-signature'] ?? '')))) throw new HttpError(403, 'Bad signature');
    } else if (!db().settings.twilio.enabled) throw new HttpError(403, 'Twilio is not set up');
    const from = str(params.From, 60);
    const text = str(params.Body, 4000);
    if (!from || !text) throw new HttpError(400, 'Missing From or Body');
    const channel = from.startsWith('whatsapp:') ? 'whatsapp' : 'sms';
    const existing = svc.findOpenTicket((t) => t.requester.phone === from);
    await svc.receive({ channel, requester: { phone: from }, text, existing });
    return { __twiml: true };
  });

  return r;
}

/** Drop the quoted history most mail apps add below a reply. */
function stripQuoted(text: string) {
  const lines = text.split(/\r?\n/);
  const cut = lines.findIndex((l) => /^On .+ wrote:$/.test(l.trim()) || /^-{2,}\s*Original Message/i.test(l.trim()));
  return (cut > 0 ? lines.slice(0, cut) : lines).filter((l) => !l.startsWith('>')).join('\n').trim();
}
