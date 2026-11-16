import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api';

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="logo" style={{ width: size, height: size }} aria-hidden>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M4 7.5A3.5 3.5 0 0 1 7.5 4h9A3.5 3.5 0 0 1 20 7.5v5a3.5 3.5 0 0 1-3.5 3.5H11l-4.5 4v-4.2A3.5 3.5 0 0 1 4 12.5z" />
      </svg>
    </span>
  );
}

export function Spinner() {
  return <span className="spinner" role="status" aria-label="Loading" />;
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'ok' | 'danger' | 'warn' | 'info'; children: ReactNode }) {
  return <div className={`notice ${kind} fade-in`}>{children}</div>;
}

/** The "Test connection" button used for AI, email and Twilio settings. */
export function TestButton({ path, body, label = 'Test connection' }: { path: string; body: () => unknown; label?: string }) {
  const [state, setState] = useState<{ busy: boolean; result?: { ok: boolean; message: string } }>({ busy: false });
  return (
    <div className="stack-sm">
      <div>
        <button
          type="button"
          className="btn"
          disabled={state.busy}
          onClick={async () => {
            setState({ busy: true });
            try {
              setState({ busy: false, result: await api(path, { body: body() }) });
            } catch (e: any) {
              setState({ busy: false, result: { ok: false, message: e.message } });
            }
          }}
        >
          {state.busy ? <Spinner /> : <PlugIcon />}
          {state.busy ? 'Testing…' : label}
        </button>
      </div>
      {state.result && <Notice kind={state.result.ok ? 'ok' : 'danger'}>{state.result.ok ? '✓ ' : ''}{state.result.message}</Notice>}
    </div>
  );
}

export function Dropzone({ onFiles, compact }: { onFiles: (files: File[]) => void; compact?: boolean }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`dropzone ${over ? 'over' : ''}`}
      style={compact ? { padding: '28px 20px' } : undefined}
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles([...e.dataTransfer.files]); }}
    >
      <div className="big">Drop your documents here</div>
      <div className="muted small">or click to choose files. PDF, text, Markdown, or saved web pages, up to 25 MB each.</div>
      <input ref={input} type="file" multiple hidden accept=".pdf,.txt,.md,.markdown,.html,.htm,.csv" onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2800);
    return () => clearTimeout(t);
  }, [msg]);
  return { show: setMsg, node: msg ? <div className="toast">{msg}</div> : null };
}

export const STATUS_LABEL: Record<string, { label: string; kind: string }> = {
  processing: { label: 'Working on it', kind: '' },
  needs_review: { label: 'Needs your review', kind: 'accent' },
  needs_person: { label: 'Needs a person', kind: 'danger' },
  replied: { label: 'Replied', kind: 'ok' },
  closed: { label: 'Closed', kind: '' },
};
export const URGENCY_LABEL: Record<string, { label: string; kind: string }> = {
  low: { label: 'Low', kind: '' },
  normal: { label: 'Normal', kind: '' },
  high: { label: 'High', kind: 'warn' },
  urgent: { label: 'Urgent', kind: 'danger' },
};
export const CHANNEL_LABEL: Record<string, string> = { web: 'Web form', email: 'Email', sms: 'Text message', whatsapp: 'WhatsApp' };

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, kind: '' };
  return <span className={`badge ${s.kind}`}>{status === 'processing' ? <Spinner /> : <span className="dot" />}{s.label}</span>;
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  const u = URGENCY_LABEL[urgency] ?? { label: urgency, kind: '' };
  if (urgency === 'normal' || urgency === 'low') return null;
  return <span className={`badge ${u.kind}`}>{u.label}</span>;
}

export function timeAgo(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// Small inline icons (stroke style, 18px)
const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
export const PlugIcon = () => <Icon d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5" size={16} />;
export const HomeIcon = () => <Icon d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />;
export const InboxIcon = () => <Icon d="M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" />;
export const BookIcon = () => <Icon d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5zM4 20.5A1.5 1.5 0 0 0 5.5 22H20" />;
export const GearIcon = () => <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />;
export const ClockIcon = () => <Icon d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" />;
export const ShieldIcon = () => <Icon d="M12 3 4 6v6c0 4.5 3.4 8.4 8 9 4.6-.6 8-4.5 8-9V6z" />;
export const LinkIcon = () => <Icon d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />;
export const MenuIcon = () => <Icon d="M4 7h16M4 12h16M4 17h16" />;
export const SparkIcon = () => <Icon d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" size={16} />;
