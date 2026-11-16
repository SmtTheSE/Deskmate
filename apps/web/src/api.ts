export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: opts.body !== undefined || (opts.method && opts.method !== 'GET') ? { 'content-type': 'application/json' } : {},
    body: opts.body !== undefined ? JSON.stringify(opts.body) : opts.method && opts.method !== 'GET' ? '{}' : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Something went wrong. Please try again.');
  return data as T;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export type TicketStatus = 'processing' | 'needs_review' | 'needs_person' | 'replied' | 'closed';
export interface Department { id: string; name: string; description: string; keywords: string[]; mode: 'approval' | 'auto' }
export interface TicketSummary {
  id: string; ref: string; channel: string; subject: string; status: TicketStatus; urgency: string; departmentId: string;
  category: string; summary: string; requester: { name?: string; email?: string; phone?: string }; createdAt: string; updatedAt: string;
  flagged: boolean; hasDraft: boolean; messageCount: number;
}
