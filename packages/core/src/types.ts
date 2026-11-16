// Shared types for the Deskmate core engine.

export type Urgency = 'low' | 'normal' | 'high' | 'urgent';
export type ChannelKind = 'web' | 'email' | 'sms' | 'whatsapp';
export type TemplateId = 'school' | 'university' | 'company' | 'blank';

/** How replies for a department are handled. "approval" = a person approves every reply. */
export type ReplyMode = 'approval' | 'auto';

export interface Department {
  id: string;
  name: string;
  description: string;
  /** Words that hint a message belongs here. Used by the offline triage and as model hints. */
  keywords: string[];
  mode: ReplyMode;
}

export interface OrgProfile {
  name: string;
  template: TemplateId;
  departments: Department[];
  /** Short sentence used as the sign-off in replies, e.g. "The Lincoln High front office". */
  signature: string;
}

export interface Chunk {
  id: string;
  docId: string;
  index: number;
  text: string;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  filename: string;
  createdAt: string;
  chars: number;
  chunks: Chunk[];
}

export interface SearchHit {
  chunk: Chunk;
  docTitle: string;
  score: number;
}

export interface Citation {
  docId: string;
  title: string;
  snippet: string;
}

export interface Redaction {
  token: string;
  kind: string;
  value: string;
}

export interface SafetyResult {
  flagged: boolean;
  category?: 'self_harm' | 'safeguarding' | 'violence' | 'emergency';
  reason?: string;
}

export interface TriageResult {
  departmentId: string;
  urgency: Urgency;
  category: string;
  summary: string;
  confidence: number;
  source: 'model' | 'rules';
}

export interface DraftResult {
  body: string;
  citations: Citation[];
  confidence: number;
  /** True when the reply is backed by the organization's own documents. */
  grounded: boolean;
}

export interface PipelineResult {
  redactions: Redaction[];
  safety: SafetyResult;
  triage: TriageResult;
  draft: DraftResult | null;
  model: string;
  /** Plain-language explanation of what happened, shown to staff. */
  notes: string[];
}

// ---------- Models ----------

export type ModelProvider = 'mock' | 'openai' | 'anthropic' | 'ollama';

export interface ModelSettings {
  provider: ModelProvider;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface CompletionRequest {
  /** Which pipeline step is asking. Real models ignore this; the offline mock uses it. */
  task: 'triage' | 'draft';
  system: string;
  prompt: string;
  /** Structured inputs, only used by the offline mock model. */
  context: TriageContext | DraftContext;
  maxTokens?: number;
}

export interface TriageContext {
  kind: 'triage';
  text: string;
  departments: Department[];
}

export interface DraftContext {
  kind: 'draft';
  question: string;
  hits: SearchHit[];
  orgName: string;
  signature: string;
}

export interface TestResult {
  ok: boolean;
  message: string;
}

export interface ModelAdapter {
  provider: ModelProvider;
  label: string;
  complete(req: CompletionRequest): Promise<string>;
  test(): Promise<TestResult>;
}
