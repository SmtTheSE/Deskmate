import type { CompletionRequest, DraftContext, ModelAdapter, TriageContext, Urgency } from '../types.ts';
import { tokenize } from '../knowledge.ts';

/**
 * An offline "model" so Deskmate works with no API keys at all.
 * It triages with keyword matching and writes replies by quoting the most
 * relevant sentences from the organization's own documents.
 */
export class MockModel implements ModelAdapter {
  provider = 'mock' as const;
  label = 'Built-in offline assistant (no AI account needed)';

  async complete(req: CompletionRequest): Promise<string> {
    if (req.context.kind === 'triage') return JSON.stringify(mockTriage(req.context));
    return mockDraft(req.context);
  }

  async test() {
    return { ok: true, message: 'The built-in assistant is ready. It works offline and never sends data anywhere.' };
  }
}

const URGENT_WORDS = ['urgent', 'asap', 'immediately', 'locked out', 'cannot log in', "can't log in", 'deadline today', 'exam today', 'outage', 'down for everyone'];
const HIGH_WORDS = ['broken', 'not working', 'error', 'failed', 'deadline', 'tomorrow', 'stuck', 'lost'];
const LOW_WORDS = ['question', 'wondering', 'curious', 'when is', 'information', 'fyi'];

export function mockTriage(ctx: TriageContext) {
  const lower = ctx.text.toLowerCase();
  const tokens = new Set(tokenize(ctx.text));
  let best = ctx.departments[0];
  let bestScore = 0;
  for (const d of ctx.departments) {
    let score = 0;
    for (const k of d.keywords) {
      const kl = k.toLowerCase();
      if (kl.includes(' ') ? lower.includes(kl) : tokens.has(tokenize(kl)[0] ?? kl)) score += kl.includes(' ') ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  let urgency: Urgency = 'normal';
  if (URGENT_WORDS.some((w) => lower.includes(w))) urgency = 'urgent';
  else if (HIGH_WORDS.some((w) => lower.includes(w))) urgency = 'high';
  else if (LOW_WORDS.some((w) => lower.includes(w))) urgency = 'low';

  // Skip a subject line or greeting when the message has a body.
  const paras = ctx.text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const body = (paras.length > 1 ? paras.slice(1).join(' ') : paras[0] ?? '').replace(/^(hi|hello|dear|hey)\b[^,.!]*[,.!]\s*/i, '');
  const firstSentence = body.split(/(?<=[.!?])\s/)[0] ?? '';
  return {
    departmentId: best?.id ?? 'general',
    urgency,
    category: bestScore > 0 ? `${best?.name ?? 'General'} request` : 'General question',
    summary: firstSentence.length > 160 ? firstSentence.slice(0, 157) + '…' : firstSentence,
    confidence: bestScore === 0 ? 0.3 : Math.min(0.95, 0.55 + bestScore * 0.12),
  };
}

export function mockDraft(ctx: DraftContext): string {
  const q = new Set(tokenize(ctx.question));
  const top = ctx.hits.slice(0, 2);
  if (!top.length) {
    return [
      'Hello,',
      '',
      "Thank you for getting in touch. I couldn't find an answer to this in our documents, so I've passed your message to a member of our team who will follow up with you directly.",
      '',
      `Best wishes,\n${ctx.signature}`,
    ].join('\n');
  }
  const sentences: { text: string; score: number; source: number; order: number }[] = [];
  top.forEach((hit, i) => {
    hit.chunk.text.split(/(?<=[.!?])\s+|\n+/).forEach((s, j) => {
      const t = s.trim();
      if (t.length < 25 || !/[.!?]$/.test(t)) return;
      const overlap = tokenize(t).filter((w) => q.has(w)).length;
      sentences.push({ text: t, score: overlap + (i === 0 ? 0.5 : 0), source: i + 1, order: i * 1000 + j });
    });
  });
  const best = Math.max(0, ...sentences.map((s) => s.score));
  const picked = sentences
    .filter((s) => s.score >= 1 && s.score >= best * 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .sort((a, b) => a.order - b.order);
  const chosen = picked.length ? picked : sentences.slice(0, 2);
  const body = chosen
    .map((s, k) => (chosen[k + 1]?.source === s.source ? s.text : `${s.text} [${s.source}]`))
    .join(' ');
  return ['Hello,', '', 'Thank you for your message. Here is what our guidance says:', '', body, '', 'If this does not fully answer your question, just reply and a member of our team will help.', '', `Best wishes,\n${ctx.signature}`].join('\n');
}
