import { useEffect, useState } from 'react';
import { api } from '../api';
import { Field, Logo, Notice, Spinner, timeAgo } from '../components/ui';

/** The public page anyone can use to ask for help. No account needed. */
export function HelpForm() {
  const [org, setOrg] = useState<{ name: string; departments: { id: string; name: string; description: string }[] } | null>(null);
  const [form, setForm] = useState({ name: '', email: '', departmentId: '', subject: '', message: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ ref: string; statusUrl: string } | null>(null);

  useEffect(() => { api('/api/status').then((s) => setOrg(s.org)); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try { setSent(await api('/api/public/tickets', { body: form })); } catch (err: any) { setError(err.message); }
    setBusy(false);
  };

  if (!org) return <div className="center-screen"><Spinner /></div>;
  return (
    <div className="public">
      <div className="public-inner fade-in">
        <div className="row" style={{ marginBottom: 40 }}><Logo /><span className="serif" style={{ fontSize: 18 }}>{org.name}</span></div>
        {sent ? (
          <div className="stack">
            <h1>Thanks, we've got it.</h1>
            <p className="muted" style={{ fontSize: 17 }}>Your reference is <strong className="mono">{sent.ref}</strong>. A member of our team will reply{form.email ? ` to ${form.email}` : ''} soon.</p>
            <div className="card flat stack-sm">
              <div className="label">Keep this link to check for a reply</div>
              <a href={sent.statusUrl}>{location.origin}{sent.statusUrl}</a>
            </div>
          </div>
        ) : (
          <form className="stack" onSubmit={submit}>
            <div>
              <h1>How can we help?</h1>
              <p className="muted" style={{ fontSize: 17 }}>Send us your question and we'll get back to you. Please don't share passwords.</p>
            </div>
            <div className="grid-2">
              <Field label="Your name" htmlFor="n"><input id="n" className="input" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Email" hint="So we can reply to you" htmlFor="em"><input id="em" className="input" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            </div>
            <Field label="What is it about?" htmlFor="d">
              <select id="d" className="select" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">I'm not sure</option>
                {org.departments.map((d) => <option key={d.id} value={d.id}>{d.name}{d.description ? ` (${d.description})` : ''}</option>)}
              </select>
            </Field>
            <Field label="Subject" htmlFor="s"><input id="s" className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
            <Field label="Your message" htmlFor="m"><textarea id="m" className="textarea" rows={6} required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
            <input tabIndex={-1} autoComplete="off" aria-hidden style={{ position: 'absolute', left: -9999 }} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            {error && <Notice kind="danger">{error}</Notice>}
            <div><button className="btn primary lg" disabled={busy}>{busy && <Spinner />}Send message</button></div>
            <p className="xs faint">Messages are read by our staff. An AI assistant may help draft replies, and personal details are hidden from it.</p>
          </form>
        )}
      </div>
    </div>
  );
}

export function HelpStatus({ refId }: { refId: string }) {
  const key = new URLSearchParams(location.search).get('key') ?? '';
  const [t, setT] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => api(`/api/public/tickets/${refId}?key=${encodeURIComponent(key)}`).then(setT).catch((e) => setError(e.message));
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, []);

  if (error) return <div className="center-screen"><Notice kind="danger">{error}</Notice></div>;
  if (!t) return <div className="center-screen"><Spinner /></div>;
  return (
    <div className="public">
      <div className="public-inner fade-in stack">
        <div className="row" style={{ marginBottom: 24 }}><Logo /><span className="serif" style={{ fontSize: 18 }}>{t.orgName}</span></div>
        <div>
          <div className="faint small mono">{t.ref}</div>
          <h1 style={{ fontSize: 28 }}>{t.subject}</h1>
          <div style={{ marginTop: 8 }}>{t.status === 'answered' ? <span className="badge ok"><span className="dot" />Answered</span> : t.status === 'closed' ? <span className="badge">Closed</span> : <span className="badge accent"><span className="dot" />We're on it</span>}</div>
        </div>
        {t.messages.map((m: any, i: number) => (
          <div key={i} className={`msg ${m.direction}`}>
            <div className="small faint">{m.direction === 'in' ? 'You' : t.orgName} · {timeAgo(m.at)}</div>
            <div className="body">{m.body}</div>
          </div>
        ))}
        <form className="stack-sm" onSubmit={async (e) => {
          e.preventDefault();
          if (!reply.trim()) return;
          setBusy(true);
          try { await api(`/api/public/tickets/${refId}/reply?key=${encodeURIComponent(key)}`, { body: { message: reply } }); setReply(''); await load(); } catch (err: any) { setError(err.message); }
          setBusy(false);
        }}>
          <textarea className="textarea" placeholder="Add a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
          <div><button className="btn dark" disabled={busy || !reply.trim()}>{busy && <Spinner />}Send reply</button></div>
        </form>
      </div>
    </div>
  );
}
