import type { SafetyResult } from './types.ts';

/**
 * Sensitive messages skip the AI entirely and go straight to a person.
 * This is a conservative keyword screen: it is meant to over-flag, never to
 * decide anything on its own. Organizations can extend the lists in settings.
 */

const CATEGORIES: { category: NonNullable<SafetyResult['category']>; reason: string; phrases: string[] }[] = [
  {
    category: 'self_harm',
    reason: 'The message may mention self-harm or suicide.',
    phrases: ['kill myself', 'suicide', 'suicidal', 'end my life', 'self harm', 'self-harm', 'hurt myself', 'want to die', 'cutting myself'],
  },
  {
    category: 'safeguarding',
    reason: 'The message may describe abuse, bullying or a child at risk.',
    phrases: ['abuse', 'abused', 'touched me', 'grooming', 'bullied', 'bullying', 'unsafe at home', 'hits me', 'neglect', 'harassed', 'harassment', 'harassing'],
  },
  {
    category: 'violence',
    reason: 'The message may contain a threat of violence.',
    phrases: ['gun', 'weapon', 'shoot', 'bomb', 'stab', 'going to hurt', 'threaten', 'threat'],
  },
  {
    category: 'emergency',
    reason: 'The message may describe an emergency.',
    phrases: ['emergency', 'ambulance', 'fire alarm', 'injured', 'bleeding', 'unconscious', 'overdose', 'gas leak'],
  },
];

export function screenSafety(text: string, extraPhrases: string[] = []): SafetyResult {
  const lower = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `;
  const has = (p: string) => new RegExp(`(^|[^a-z])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(lower);
  for (const c of CATEGORIES) {
    if (c.phrases.some(has)) return { flagged: true, category: c.category, reason: c.reason };
  }
  if (extraPhrases.some((p) => p.trim() && has(p.toLowerCase().trim()))) {
    return { flagged: true, category: 'safeguarding', reason: 'The message matched a phrase your organization marked as sensitive.' };
  }
  return { flagged: false };
}
