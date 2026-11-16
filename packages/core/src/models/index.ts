import type { ModelAdapter, ModelSettings } from '../types.ts';
import { MockModel } from './mock.ts';
import { AnthropicModel, OllamaModel, OpenAIModel } from './remote.ts';

export { MockModel, AnthropicModel, OllamaModel, OpenAIModel };

export function createModel(s: ModelSettings): ModelAdapter {
  switch (s.provider) {
    case 'openai': return new OpenAIModel(s);
    case 'anthropic': return new AnthropicModel(s);
    case 'ollama': return new OllamaModel(s);
    default: return new MockModel();
  }
}

export const MODEL_CHOICES = [
  { provider: 'mock', title: 'Built-in assistant', blurb: 'Works right away, offline, free. Replies quote your documents directly.', needsKey: false },
  { provider: 'openai', title: 'OpenAI', blurb: 'Natural, well-written replies. Needs an OpenAI account key.', needsKey: true, defaultModel: 'gpt-4o-mini' },
  { provider: 'anthropic', title: 'Anthropic Claude', blurb: 'Careful, well-written replies. Needs an Anthropic account key.', needsKey: true, defaultModel: 'claude-haiku-5-5' },
  { provider: 'ollama', title: 'Private model on your own server', blurb: 'Nothing leaves your network. Needs Ollama installed by your IT team.', needsKey: false, defaultModel: 'llama3.1' },
] as const;
