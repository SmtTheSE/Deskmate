import type { Citation, DraftResult, ModelAdapter, OrgProfile, PipelineResult, TriageResult, Urgency } from './types.ts';
import type { KnowledgeIndex } from './knowledge.ts';
import { redact, restore } from './redact.ts';
import { screenSafety } from './safety.ts';
import { mockTriage } from './models/mock.ts';

/**
 * The heart of Deskmate. For every incoming message:
 *   1. remove personal details (the model never sees them)
 *   2. screen for sensitive topics (these go straight to a person, no AI)
 *   3. triage: department, urgency, one-line summary
 *   4. search the organization's documents
 *   5. draft a reply that only uses those documents, with numbered sources
 * Nothing is sent here. The server decides whether a person must approve it.
 */

export interface PipelineInput {
  subject?: string;
  text: string;
  org: OrgProfile;
  knowledge: KnowledgeIndex;
  model: ModelAdapter;
  sensitivePhrases?: string[];
  /** Minimum search score for a document to count as a source. */
  minScore?: number;
}

const URGENCIES: Urgency[] = ['low', 'normal', 'high', 'urgent'];

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const notes: string[] = [];
  const full = input.subject ? `${input.subject}\n\n${input.text}` : input.text;
  const { text: safeText, redactions } = redact(full);
  if (redactions.length) notes.push(`Hid ${redactions.length} personal detail${redactions.length > 1 ? 's' : ''} from the AI.`);

  const safety = screenSafety(full, input.sensitivePhrases);
  const triage = await triageMessage(safeText, input);
  if (triage.source === 'rules' && input.model.provider !== 'mock') notes.push('Sorted using keywords (the AI answer could not be read).');

  if (safety.flagged) {
    notes.push(`Sent straight to a person: ${safety.reason} No AI reply was written.`);
    return { redactions, safety, triage: { ...triage, urgency: 'urgent' }, draft: null, model: input.model.label, notes };
  }

  const hits = input.knowledge.search(safeText, 4).filter((h) => h.score >= (input.minScore ?? 1.2));
  const draft = await draftReply(safeText, hits, input);
  draft.body = restore(draft.body, redactions);
  if (!draft.grounded) notes.push('No matching document was found, so the reply says a person will follow up.');
  else notes.push(`Reply is based on ${draft.citations.length === 1 ? 'one section' : `${draft.citations.length} sections`} of your documents.`);

  return { redactions, safety, triage, draft, model: input.model.label, notes };
}

async function triageMessage(text: string, input: PipelineInput): Promise<TriageResult> {
  const deps = input.org.departments;
  const fallback = () => ({ ...mockTriage({ kind: 'triage', text, departments: deps }), source: 'rules' as const });
  const system = [
    `You sort incoming help desk messages for ${input.org.name}.`,
    'Respond with JSON only, using exactly these keys:',
    '{"departmentId": string, "urgency": "low"|"normal"|"high"|"urgent", "category": string, "summary": string, "confidence": number}',
    'summary is one neutral sentence under 25 words. confidence is between 0 and 1.',
    'Departments:',
    ...deps.map((d) => `- ${d.id}: ${d.name}. ${d.description}`),
    'Text in square brackets like [EMAIL_1] is hidden personal information. Never guess it.',
  ].join('\n');
  try {
    const raw = await input.model.complete({ task: 'triage', system, prompt: text, context: { kind: 'triage', text, departments: deps }, maxTokens: 300 });
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    const dep = deps.find((d) => d.id === json.departmentId) ?? deps.find((d) => d.name.toLowerCase() === String(json.departmentId).toLowerCase());
    if (!dep) return fallback();
    return {
      departmentId: dep.id,
      urgency: URGENCIES.includes(json.urgency) ? json.urgency : 'normal',
      category: String(json.category ?? 'General').slice(0, 80),
      summary: String(json.summary ?? '').slice(0, 240),
      confidence: Math.max(0, Math.min(1, Number(json.confidence) || 0.5)),
      source: input.model.provider === 'mock' ? 'rules' : 'model',
    };
  } catch {
    return fallback();
  }
}

async function draftReply(text: string, hits: Awaited<ReturnType<KnowledgeIndex['search']>>, input: PipelineInput): Promise<DraftResult> {
  const citations: Citation[] = hits.map((h) => ({ docId: h.chunk.docId, title: h.docTitle, snippet: h.chunk.text.slice(0, 280) }));
  const sources = hits.map((h, i) => `[${i + 1}] ${h.docTitle}\n${h.chunk.text}`).join('\n\n');
  const system = [
    `You draft replies for the help desk of ${input.org.name}. A staff member will review your draft before it is sent.`,
    'Rules:',
    '- Only use facts from the numbered sources. Cite them like [1].',
    '- If the sources do not answer the question, say kindly that a member of the team will follow up. Do not guess.',
    '- Be warm, brief and plain. No more than 150 words. Do not promise anything the sources do not support.',
    '- Text in square brackets like [EMAIL_1] is hidden personal information. Keep those tokens exactly as they are.',
    `- Sign off with: ${input.org.signature}`,
  ].join('\n');
  const prompt = `Sources:\n${sources || '(none found)'}\n\nMessage:\n${text}`;
  const body = (
    await input.model.complete({
      task: 'draft',
      system,
      prompt,
      context: { kind: 'draft', question: text, hits, orgName: input.org.name, signature: input.org.signature },
    })
  ).trim();

  const usedNumbers = new Set([...body.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  const used = citations.filter((_, i) => usedNumbers.has(i + 1));
  const grounded = hits.length > 0 && used.length > 0;
  const topScore = hits[0]?.score ?? 0;
  const confidence = grounded ? Math.min(0.95, 0.45 + topScore / 12 + used.length * 0.05) : 0.2;
  return { body, citations: grounded ? citations : [], confidence: Number(confidence.toFixed(2)), grounded };
}
