import type { Redaction } from './types.ts';

/**
 * Removes personal details before any text is sent to an AI model.
 * Each value is replaced with a token like [EMAIL_1] and can be restored
 * afterwards, so staff see the real values but the model never does.
 */

interface Rule {
  kind: string;
  pattern: RegExp;
  validate?: (match: string) => boolean;
}

function luhn(digits: string): boolean {
  const d = digits.replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

const RULES: Rule[] = [
  { kind: 'EMAIL', pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { kind: 'CARD', pattern: /\b(?:\d[ -]?){13,19}\b/g, validate: luhn },
  { kind: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: 'PHONE', pattern: /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}(?:[\s.-]?\d{2,4})?\b/g,
    validate: (m) => m.replace(/\D/g, '').length >= 9 },
  { kind: 'IP', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  { kind: 'DOB', pattern: /\b(?:born|dob|date of birth)[:\s]+\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}\b/gi },
  { kind: 'ID', pattern: /\b(?:student|employee|staff|badge)\s*(?:id|number|no\.?|#)\s*[:#]?\s*[A-Z0-9-]{4,}\b/gi },
];

export function redact(text: string, extraPatterns: RegExp[] = []): { text: string; redactions: Redaction[] } {
  const redactions: Redaction[] = [];
  const counters: Record<string, number> = {};
  const seen = new Map<string, string>();
  let out = text;

  const rules: Rule[] = [...RULES, ...extraPatterns.map((p) => ({ kind: 'CUSTOM', pattern: p }))];
  for (const rule of rules) {
    out = out.replace(rule.pattern, (match) => {
      if (/^\[[A-Z]+_\d+\]$/.test(match)) return match;
      if (rule.validate && !rule.validate(match)) return match;
      const existing = seen.get(match);
      if (existing) return existing;
      counters[rule.kind] = (counters[rule.kind] ?? 0) + 1;
      const token = `[${rule.kind}_${counters[rule.kind]}]`;
      seen.set(match, token);
      redactions.push({ token, kind: rule.kind, value: match });
      return token;
    });
  }
  return { text: out, redactions };
}

/** Put the original values back (used only for text shown to staff). */
export function restore(text: string, redactions: Redaction[]): string {
  let out = text;
  for (const r of redactions) out = out.split(r.token).join(r.value);
  return out;
}
