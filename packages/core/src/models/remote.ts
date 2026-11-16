import type { CompletionRequest, ModelAdapter, ModelSettings, TestResult } from '../types.ts';

/**
 * Adapters for hosted and local models. They use plain fetch so there are no
 * vendor SDKs to install. Every request has already been through PII redaction.
 */

const TIMEOUT_MS = 60_000;

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(friendlyHttpError(res.status, text));
  return JSON.parse(text);
}

function friendlyHttpError(status: number, body: string): string {
  if (status === 401 || status === 403) return 'The key was not accepted. Check that you copied the whole key.';
  if (status === 404) return 'The model name or address was not found. Check the model name.';
  if (status === 429) return 'The AI provider says you have hit a usage or billing limit.';
  return `The AI provider returned an error (${status}): ${body.slice(0, 200)}`;
}

function friendly(e: unknown): TestResult {
  const msg = e instanceof Error ? e.message : String(e);
  if (/fetch failed|ECONNREFUSED|ENOTFOUND/i.test(msg)) return { ok: false, message: 'Could not reach the server. Check the address and that it is running.' };
  if (/timeout|aborted/i.test(msg)) return { ok: false, message: 'The connection timed out.' };
  return { ok: false, message: msg };
}

export class OpenAIModel implements ModelAdapter {
  provider = 'openai' as const;
  label: string;
  private s: ModelSettings;
  constructor(s: ModelSettings) {
    this.s = s;
    this.label = `OpenAI (${this.model})`;
  }
  get model() { return this.s.model || 'gpt-4o-mini'; }
  get base() { return (this.s.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, ''); }

  async complete(req: CompletionRequest): Promise<string> {
    const data = await post(`${this.base}/chat/completions`, { authorization: `Bearer ${this.s.apiKey}` }, {
      model: this.model,
      max_tokens: req.maxTokens ?? 700,
      temperature: 0.2,
      messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.prompt }],
      ...(req.task === 'triage' ? { response_format: { type: 'json_object' } } : {}),
    });
    return data.choices?.[0]?.message?.content ?? '';
  }

  async test(): Promise<TestResult> {
    if (!this.s.apiKey) return { ok: false, message: 'Paste your OpenAI key first.' };
    try {
      await this.complete({ task: 'draft', system: 'Reply with OK.', prompt: 'ping', context: { kind: 'draft', question: '', hits: [], orgName: '', signature: '' }, maxTokens: 5 });
      return { ok: true, message: `Connected to OpenAI using ${this.model}.` };
    } catch (e) { return friendly(e); }
  }
}

export class AnthropicModel implements ModelAdapter {
  provider = 'anthropic' as const;
  label: string;
  private s: ModelSettings;
  constructor(s: ModelSettings) {
    this.s = s;
    this.label = `Anthropic (${this.model})`;
  }
  get model() { return this.s.model || 'claude-haiku-5-5'; }
  get base() { return (this.s.baseUrl || 'https://api.anthropic.com').replace(/\/$/, ''); }

  async complete(req: CompletionRequest): Promise<string> {
    const data = await post(`${this.base}/v1/messages`, { 'x-api-key': this.s.apiKey ?? '', 'anthropic-version': '2023-06-01' }, {
      model: this.model,
      max_tokens: req.maxTokens ?? 700,
      system: req.system,
      messages: [{ role: 'user', content: req.prompt }],
    });
    return (data.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  }

  async test(): Promise<TestResult> {
    if (!this.s.apiKey) return { ok: false, message: 'Paste your Anthropic key first.' };
    try {
      await this.complete({ task: 'draft', system: 'Reply with OK.', prompt: 'ping', context: { kind: 'draft', question: '', hits: [], orgName: '', signature: '' }, maxTokens: 5 });
      return { ok: true, message: `Connected to Anthropic using ${this.model}.` };
    } catch (e) { return friendly(e); }
  }
}

export class OllamaModel implements ModelAdapter {
  provider = 'ollama' as const;
  label: string;
  private s: ModelSettings;
  constructor(s: ModelSettings) {
    this.s = s;
    this.label = `Local model on your own server (${this.model})`;
  }
  get model() { return this.s.model || 'llama3.1'; }
  get base() { return (this.s.baseUrl || 'http://localhost:11434').replace(/\/$/, ''); }

  async complete(req: CompletionRequest): Promise<string> {
    const data = await post(`${this.base}/api/chat`, {}, {
      model: this.model,
      stream: false,
      ...(req.task === 'triage' ? { format: 'json' } : {}),
      options: { temperature: 0.2 },
      messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.prompt }],
    });
    return data.message?.content ?? '';
  }

  async test(): Promise<TestResult> {
    try {
      const res = await fetch(`${this.base}/api/tags`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return { ok: false, message: `The local model server answered with an error (${res.status}).` };
      const data: any = await res.json();
      const names: string[] = (data.models ?? []).map((m: any) => String(m.name));
      if (!names.some((n) => n === this.model || n.startsWith(`${this.model}:`))) {
        return { ok: false, message: `Connected, but the model "${this.model}" is not downloaded yet. Available: ${names.join(', ') || 'none'}.` };
      }
      return { ok: true, message: `Connected to the local model "${this.model}". Data stays on your own server.` };
    } catch (e) { return friendly(e); }
  }
}
