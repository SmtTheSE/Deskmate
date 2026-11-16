import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChannelKind, DraftResult, KnowledgeDoc, ModelProvider, OrgProfile, SafetyResult, Urgency } from '@deskmate/core';

/**
 * A single JSON file holds everything. That keeps installation to "one folder
 * to back up" for small organizations. The Store class is the only thing that
 * touches it, so a Postgres implementation can replace it later.
 */

export type TicketStatus = 'processing' | 'needs_review' | 'needs_person' | 'replied' | 'closed';

export interface Message {
  id: string;
  direction: 'in' | 'out';
  body: string;
  at: string;
  author: string;
  aiDrafted?: boolean;
  edited?: boolean;
  delivery?: 'sent' | 'status_page' | 'failed';
  deliveryNote?: string;
}

export interface Ticket {
  id: string;
  ref: string;
  accessKey: string;
  channel: ChannelKind;
  requester: { name?: string; email?: string; phone?: string };
  subject: string;
  status: TicketStatus;
  departmentId: string;
  urgency: Urgency;
  category: string;
  summary: string;
  messages: Message[];
  draft: DraftResult | null;
  notes: string[];
  safety: SafetyResult;
  redactionCount: number;
  model: string;
  createdAt: string;
  updatedAt: string;
  firstReplyAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'staff';
  createdAt: string;
}

export interface Session { id: string; userId: string; expiresAt: string }

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  ticketRef?: string;
  detail: string;
}

export interface Settings {
  model: { provider: ModelProvider; model?: string; baseUrl?: string };
  email: { enabled: boolean; smtpHost?: string; smtpPort?: number; smtpUser?: string; fromAddress?: string; inboundToken: string };
  twilio: { enabled: boolean; accountSid?: string; smsNumber?: string; whatsappNumber?: string };
  policy: { sensitivePhrases: string[]; autoSendMinConfidence: number };
}

export interface Secrets { modelApiKey?: string; smtpPass?: string; twilioAuthToken?: string }

export interface Db {
  version: 1;
  setupCompletedAt?: string;
  org: OrgProfile | null;
  settings: Settings;
  /** Encrypted values. Read through Store.getSecret. */
  secrets: Secrets;
  users: User[];
  sessions: Session[];
  tickets: Ticket[];
  knowledge: KnowledgeDoc[];
  audit: AuditEntry[];
  nextTicketNumber: number;
}

export function emptyDb(inboundToken: string): Db {
  return {
    version: 1,
    org: null,
    settings: {
      model: { provider: 'mock' },
      email: { enabled: false, inboundToken },
      twilio: { enabled: false },
      policy: { sensitivePhrases: [], autoSendMinConfidence: 0.8 },
    },
    secrets: {},
    users: [],
    sessions: [],
    tickets: [],
    knowledge: [],
    audit: [],
    nextTicketNumber: 1001,
  };
}

export class Store {
  db: Db;
  private file: string;
  private timer: NodeJS.Timeout | null = null;

  constructor(dataDir: string, makeToken: () => string) {
    mkdirSync(dataDir, { recursive: true });
    this.file = join(dataDir, 'deskmate.json');
    this.db = existsSync(this.file) ? JSON.parse(readFileSync(this.file, 'utf8')) : emptyDb(makeToken());
    if (!existsSync(this.file)) this.flush();
  }

  /** Save soon (batched). */
  save() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 50);
  }

  /** Save now, atomically, so a crash never leaves a half-written file. */
  flush() {
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.db, null, 1));
    renameSync(tmp, this.file);
  }

  get configured() {
    return Boolean(this.db.setupCompletedAt && this.db.org);
  }
}
