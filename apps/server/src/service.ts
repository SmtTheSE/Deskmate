import { Bm25Index, chunkText, createModel, htmlToText, runPipeline } from '@deskmate/core';
import type { ChannelKind, KnowledgeDoc, ModelAdapter } from '@deskmate/core';
import { decrypt, encrypt, randomId } from './crypto.ts';
import { sendEmail, sendTwilio } from './channels.ts';
import type { Secrets, Store, Ticket } from './store.ts';

/** Business logic shared by the HTTP routes: tickets, replies, knowledge, audit. */
export class Service {
  store: Store;
  publicUrl: string;
  private index: Bm25Index | null = null;

  constructor(store: Store, publicUrl: string) {
    this.store = store;
    this.publicUrl = publicUrl;
  }

  get db() { return this.store.db; }

  // ---------- secrets ----------
  getSecret(k: keyof Secrets) { return decrypt(this.db.secrets[k]); }
  setSecret(k: keyof Secrets, v: string | undefined) {
    if (v === undefined) return;
    if (v === '') delete this.db.secrets[k];
    else this.db.secrets[k] = encrypt(v);
  }

  model(): ModelAdapter {
    const m = this.db.settings.model;
    return createModel({ ...m, apiKey: this.getSecret('modelApiKey') });
  }

  emailConfig() {
    const e = this.db.settings.email;
    return { ...e, smtpPass: this.getSecret('smtpPass') };
  }
  twilioConfig() {
    return { ...this.db.settings.twilio, authToken: this.getSecret('twilioAuthToken') };
  }

  // ---------- audit ----------
  audit(actor: string, action: string, detail: string, ticketRef?: string) {
    this.db.audit.unshift({ id: randomId(), at: new Date().toISOString(), actor, action, detail, ticketRef });
    if (this.db.audit.length > 5000) this.db.audit.length = 5000;
    this.store.save();
  }

  // ---------- knowledge ----------
  knowledgeIndex() {
    return (this.index ??= new Bm25Index(this.db.knowledge));
  }

  addKnowledge(title: string, filename: string, text: string, actor: string): KnowledgeDoc {
    const id = randomId();
    const clean = /\.html?$/i.test(filename) ? htmlToText(text) : text;
    const doc: KnowledgeDoc = { id, title, filename, createdAt: new Date().toISOString(), chars: clean.length, chunks: chunkText(id, clean) };
    this.db.knowledge.push(doc);
    this.index = null;
    this.audit(actor, 'knowledge_added', `Added "${title}" (${doc.chunks.length} sections).`);
    return doc;
  }

  removeKnowledge(id: string, actor: string) {
    const doc = this.db.knowledge.find((d) => d.id === id);
    this.db.knowledge = this.db.knowledge.filter((d) => d.id !== id);
    this.index = null;
    if (doc) this.audit(actor, 'knowledge_removed', `Removed "${doc.title}".`);
  }

  // ---------- tickets ----------
  findOpenTicket(match: (t: Ticket) => boolean) {
    return this.db.tickets.find((t) => t.status !== 'closed' && match(t));
  }

  /** Create a ticket from any channel, or add to an existing conversation. */
  async receive(input: { channel: ChannelKind; requester: Ticket['requester']; subject?: string; text: string; departmentId?: string; existing?: Ticket }): Promise<Ticket> {
    const now = new Date().toISOString();
    let t = input.existing;
    if (t) {
      t.messages.push({ id: randomId(), direction: 'in', body: input.text, at: now, author: t.requester.name || t.requester.email || t.requester.phone || 'Requester' });
      t.status = 'processing';
      t.updatedAt = now;
    } else {
      t = {
        id: randomId(),
        ref: `HD-${this.db.nextTicketNumber++}`,
        accessKey: randomId(12),
        channel: input.channel,
        requester: input.requester,
        subject: (input.subject || input.text.split('\n')[0] || 'Message').slice(0, 120),
        status: 'processing',
        departmentId: input.departmentId ?? this.db.org?.departments[0]?.id ?? 'general',
        urgency: 'normal',
        category: '',
        summary: '',
        messages: [{ id: randomId(), direction: 'in', body: input.text, at: now, author: input.requester.name || input.requester.email || input.requester.phone || 'Requester' }],
        draft: null,
        notes: [],
        safety: { flagged: false },
        redactionCount: 0,
        model: '',
        createdAt: now,
        updatedAt: now,
      };
      this.db.tickets.unshift(t);
      this.audit('system', 'ticket_received', `New ${channelName(input.channel)} message.`, t.ref);
    }
    this.store.save();
    // Run the AI steps in the background so the sender gets an instant response.
    void this.process(t, input.departmentId);
    return t;
  }

  async process(t: Ticket, chosenDepartment?: string) {
    const org = this.db.org;
    if (!org) return;
    try {
      const lastIn = [...t.messages].reverse().find((m) => m.direction === 'in');
      const history = t.messages.length > 1 ? t.messages.slice(-4, -1).map((m) => `${m.direction === 'in' ? 'Requester' : 'Us'}: ${m.body}`).join('\n') + '\n\nNewest message:\n' : '';
      const res = await runPipeline({
        subject: t.messages.length === 1 && !(lastIn?.body ?? '').startsWith(t.subject) ? t.subject : undefined,
        text: history + (lastIn?.body ?? ''),
        org,
        knowledge: this.knowledgeIndex(),
        model: this.model(),
        sensitivePhrases: this.db.settings.policy.sensitivePhrases,
      });
      t.safety = res.safety;
      t.urgency = res.triage.urgency;
      t.category = res.triage.category;
      t.summary = res.triage.summary;
      // If the sender picked a department on the web form, respect it unless the message is sensitive.
      t.departmentId = chosenDepartment && org.departments.some((d) => d.id === chosenDepartment) ? chosenDepartment : res.triage.departmentId;
      t.draft = res.draft;
      t.notes = res.notes;
      t.redactionCount = res.redactions.length;
      t.model = res.model;
      t.status = res.safety.flagged ? 'needs_person' : 'needs_review';
      t.updatedAt = new Date().toISOString();
      this.audit('ai', res.safety.flagged ? 'escalated' : 'draft_ready', res.safety.flagged ? `Sent to a person: ${res.safety.reason}` : `Draft ready (${Math.round((res.draft?.confidence ?? 0) * 100)}% confidence). ${res.notes.join(' ')}`, t.ref);

      const dep = org.departments.find((d) => d.id === t.departmentId);
      const policy = this.db.settings.policy;
      if (dep?.mode === 'auto' && res.draft?.grounded && res.draft.confidence >= policy.autoSendMinConfidence && !res.safety.flagged) {
        await this.sendReply(t, res.draft.body, 'ai', { aiDrafted: true, edited: false });
        this.audit('ai', 'auto_sent', `Sent automatically because "${dep.name}" allows automatic replies for confident, sourced answers.`, t.ref);
      }
    } catch (e: any) {
      t.status = 'needs_person';
      t.notes = [`The AI step failed, so a person needs to reply: ${e?.message ?? e}`];
      this.audit('system', 'ai_failed', String(e?.message ?? e), t.ref);
    }
    this.store.save();
  }

  /** Deliver a reply through the channel the message came from. */
  async sendReply(t: Ticket, body: string, actor: string, flags: { aiDrafted: boolean; edited: boolean }) {
    const now = new Date().toISOString();
    const msg: Ticket['messages'][number] = { id: randomId(), direction: 'out', body, at: now, author: actor, ...flags, delivery: 'status_page' };
    const statusLink = `${this.publicUrl}/help/status/${t.ref}?key=${t.accessKey}`;
    try {
      if ((t.channel === 'email' || t.channel === 'web') && t.requester.email && this.db.settings.email.enabled) {
        await sendEmail(this.emailConfig(), t.requester.email, `Re: ${t.subject} [${t.ref}]`, `${body}\n\n—\nReference ${t.ref}. Reply to this email to continue the conversation.`);
        msg.delivery = 'sent';
        msg.deliveryNote = `Emailed to ${t.requester.email}`;
      } else if ((t.channel === 'sms' || t.channel === 'whatsapp') && t.requester.phone && this.db.settings.twilio.enabled) {
        await sendTwilio(this.twilioConfig(), t.requester.phone, body);
        msg.delivery = 'sent';
        msg.deliveryNote = `Sent by ${channelName(t.channel)}`;
      } else {
        msg.deliveryNote = 'Shown on the requester\'s status page (email is not set up yet).';
      }
    } catch (e: any) {
      msg.delivery = 'failed';
      msg.deliveryNote = `Could not deliver: ${e?.message ?? e}. It is still visible on the status page.`;
    }
    t.messages.push(msg);
    t.draft = null;
    t.status = 'replied';
    t.firstReplyAt ??= now;
    t.updatedAt = now;
    this.audit(actor, 'reply_sent', `${flags.aiDrafted ? (flags.edited ? 'AI draft sent after edits' : 'AI draft approved as written') : 'Reply written by staff'}. ${msg.deliveryNote}`, t.ref);
    this.store.save();
    return { msg, statusLink };
  }

  stats() {
    const ts = this.db.tickets;
    const outs = ts.flatMap((t) => t.messages.filter((m) => m.direction === 'out'));
    const ai = outs.filter((m) => m.aiDrafted);
    const firstReplyMins = ts.filter((t) => t.firstReplyAt).map((t) => (Date.parse(t.firstReplyAt!) - Date.parse(t.createdAt)) / 60000);
    const weekAgo = Date.now() - 7 * 864e5;
    return {
      total: ts.length,
      thisWeek: ts.filter((t) => Date.parse(t.createdAt) > weekAgo).length,
      needsReview: ts.filter((t) => t.status === 'needs_review').length,
      needsPerson: ts.filter((t) => t.status === 'needs_person').length,
      replied: ts.filter((t) => t.status === 'replied' || t.status === 'closed').length,
      aiReplies: ai.length,
      approvedAsWritten: ai.filter((m) => !m.edited).length,
      medianFirstReplyMinutes: median(firstReplyMins),
      documents: this.db.knowledge.length,
      byDepartment: (this.db.org?.departments ?? []).map((d) => ({ id: d.id, name: d.name, count: ts.filter((t) => t.departmentId === d.id).length })),
    };
  }
}

export function channelName(c: ChannelKind) {
  return { web: 'web form', email: 'email', sms: 'text message', whatsapp: 'WhatsApp' }[c];
}

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2);
}
