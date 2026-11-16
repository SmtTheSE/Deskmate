# Architecture

Deskmate is a small TypeScript monorepo with three parts.

```
┌──────────────────────────── apps/web (React + Vite) ────────────────────────────┐
│  /setup  wizard      /app  console (inbox, ticket, knowledge, settings, log)     │
│  /help   public form /help/status/:ref  requester's status page                  │
└───────────────────────────────────────┬──────────────────────────────────────────┘
                                        │ JSON over HTTP (same origin, cookie session)
┌───────────────────────────── apps/server (Node) ─────────────────────────────────┐
│  routes.ts   API + webhooks (/webhooks/email, /webhooks/twilio)                   │
│  service.ts  receive → process (pipeline) → approve → send → audit                │
│  channels.ts SMTP (nodemailer), Twilio REST, signature validation                 │
│  store.ts    one JSON file (atomic writes)    crypto.ts  AES-GCM secrets, scrypt  │
└───────────────────────────────────────┬──────────────────────────────────────────┘
                                        │ function calls
┌───────────────────────────── packages/core ──────────────────────────────────────┐
│  pipeline.ts  redact → safety → triage → search → draft                           │
│  redact.ts    PII tokens ([EMAIL_1]) and restore      safety.ts  sensitive screen │
│  knowledge.ts chunking + BM25 search                  templates.ts  School/Uni/Co │
│  models/      mock (offline), OpenAI, Anthropic, Ollama  (plain fetch, no SDKs)   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

## Key decisions

**A built-in inbox instead of integrating Zammad first.** The core requirement is that a non-technical admin can set the whole thing up. Asking them to install and connect a second ticketing product first defeats that. Connectors for Zammad and FreeScout come later for organizations that already use them.

**Human in the loop by default.** Every department starts in approval mode. Automatic sending is opt-in per department and only fires when the draft is grounded in documents, above a confidence threshold, and not flagged as sensitive. The share of drafts approved without edits is shown on the home page, so teams can decide on evidence when to trust automation.

**The model never sees personal details.** `redact()` swaps emails, phone numbers, card numbers (Luhn-checked), SSN-style numbers, IPs, dates of birth, and student or staff IDs for tokens before any model call. Drafts are restored with `restore()` only for staff display. A test asserts that no prompt contains the original values.

**Sensitive messages skip the AI.** `screenSafety()` is a deliberately over-inclusive keyword screen (self-harm, safeguarding, violence, emergencies, plus the organization's own phrases). Flagged messages get no draft and go to "Needs a person" as urgent.

**Grounded or honest.** Drafting prompts require citations like `[1]`. A draft counts as grounded only when it cites at least one retrieved section. Otherwise the reply says a person will follow up, and the console suggests adding the answer to Knowledge.

**Works with no keys.** `MockModel` triages by department keywords and drafts by quoting the best-matching sentences from your documents. This makes the demo, tests, and cautious first deployments work offline.

**Few dependencies.** The server uses Node's `http` module and runs TypeScript directly with Node's type stripping, so there is no build step on the server. Runtime dependencies are `nodemailer` (SMTP) and `unpdf` (PDF text). Model adapters use `fetch`.

**One JSON file for storage (for now).** Small organizations get "one folder to back up". `Store` is the only module that touches the file, so a Postgres implementation can replace it in Phase 2 without changes elsewhere. Search sits behind a `KnowledgeIndex` interface for the same reason (pgvector later).

## Security model

- **Claiming a fresh install** requires a one-time setup code printed at startup and saved to `data/setup-code.txt`. It is deleted once setup completes.
- **Sessions** are random IDs in an `HttpOnly`, `SameSite=Lax` cookie (and `Secure` when `PUBLIC_URL` is https). Passwords use scrypt.
- **CSRF**: every mutating `/api` request must be `application/json`, which a cross-site form cannot send without a CORS preflight that the server never approves.
- **Secrets** (model keys, SMTP password, Twilio token) are encrypted with AES-256-GCM using `APP_SECRET` or a generated key in the data folder, and they are never returned by the API.
- **Webhooks**: email requires a random token in the URL. Twilio requests are verified with `X-Twilio-Signature` once an auth token is saved.
- **Public endpoints** are rate limited, and the help form has a honeypot field for bots. Requesters see their conversation only with an unguessable access key.
- **Roles**: staff answer conversations and manage documents. Admins also change settings and invite people.

## Data model (abridged)

- `Ticket`: ref (`HD-1001`), channel, requester, subject, status (`processing`, `needs_review`, `needs_person`, `replied`, `closed`), department, urgency, summary, messages, current draft with citations and confidence, notes on what the AI did, safety result.
- `Message`: direction, body, author, and for replies whether it was AI-drafted, whether it was edited, and how it was delivered.
- `AuditEntry`: time, actor (`ai`, `system`, or a staff email), action, ticket ref, plain-language detail.

## Extending

- **New model**: implement `ModelAdapter` (`complete`, `test`) in `packages/core/src/models` and add it to `createModel` and `MODEL_CHOICES`.
- **New channel**: add an inbound webhook in `routes.ts` that calls `svc.receive(...)`, and a branch in `Service.sendReply`.
- **New template**: add to `TEMPLATES` in `packages/core/src/templates.ts`.
