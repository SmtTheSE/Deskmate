import type { Chunk, KnowledgeDoc, SearchHit } from './types.ts';

/**
 * A small, dependency-free knowledge search (BM25). It is good enough for a few
 * hundred handbook pages and needs no vector database. The KnowledgeIndex
 * interface lets a pgvector or embeddings-based index replace it later.
 */

const STOPWORDS = new Set(
  ('a an and are as at be but by can could do does for from had has have how i if in into is it its me my of on or our please ' +
    'should so that the their them then there these they this to was we were what when where which who why will with would you your hi hello thanks thank')
    .split(' '),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

function stem(t: string): string {
  if (t.length > 5 && t.endsWith('ing')) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith('ed')) return t.slice(0, -2);
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

/** Split text into overlapping chunks along paragraph boundaries. */
export function chunkText(docId: string, text: string, size = 900): Chunk[] {
  const paragraphs = text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim())
    .filter(Boolean);
  const chunks: Chunk[] = [];
  let buf = '';
  const push = () => {
    if (buf.trim()) chunks.push({ id: `${docId}:${chunks.length}`, docId, index: chunks.length, text: buf.trim() });
  };
  for (const p of paragraphs) {
    if (p.length > size) {
      push();
      buf = '';
      for (let i = 0; i < p.length; i += size - 150) {
        chunks.push({ id: `${docId}:${chunks.length}`, docId, index: chunks.length, text: p.slice(i, i + size) });
      }
      continue;
    }
    if ((buf + '\n\n' + p).length > size) {
      push();
      buf = p;
    } else {
      buf = buf ? `${buf}\n\n${p}` : p;
    }
  }
  push();
  return chunks;
}

export interface KnowledgeIndex {
  search(query: string, limit?: number): SearchHit[];
}

export class Bm25Index implements KnowledgeIndex {
  private docs: { chunk: Chunk; title: string; tf: Map<string, number>; len: number }[] = [];
  private df = new Map<string, number>();
  private avgLen = 1;

  constructor(knowledge: KnowledgeDoc[]) {
    for (const doc of knowledge) {
      for (const chunk of doc.chunks) {
        const tokens = tokenize(`${doc.title} ${chunk.text}`);
        const tf = new Map<string, number>();
        for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
        for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
        this.docs.push({ chunk, title: doc.title, tf, len: tokens.length });
      }
    }
    this.avgLen = this.docs.reduce((s, d) => s + d.len, 0) / Math.max(1, this.docs.length) || 1;
  }

  search(query: string, limit = 4): SearchHit[] {
    const q = [...new Set(tokenize(query))];
    if (!q.length || !this.docs.length) return [];
    const N = this.docs.length;
    const k1 = 1.4;
    const b = 0.75;
    const scored = this.docs.map((d) => {
      let score = 0;
      let matched = 0;
      for (const t of q) {
        const f = d.tf.get(t);
        if (!f) continue;
        matched++;
        const df = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / this.avgLen));
      }
      // Reward chunks that cover more of the question.
      score *= 0.5 + 0.5 * (matched / q.length);
      return { chunk: d.chunk, docTitle: d.title, score };
    });
    return scored
      .filter((h) => h.score > 0)
      .sort((a, b2) => b2.score - a.score)
      .slice(0, limit);
  }
}

/** Convert an uploaded file to plain text. PDFs are handled by the server. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|br)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
