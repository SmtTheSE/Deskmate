import { useEffect, useState } from 'react';
import { api } from '../api';
import { CHANNEL_LABEL, Notice, ShieldIcon, SparkIcon, Spinner, StatusBadge, timeAgo, useToast } from '../components/ui';
import { Link } from '../router';
import type { Session } from './Console';

/** One conversation, with the AI draft waiting for a person to approve, edit, or discard it. */
export default function TicketView({ id, session, onChange }: { id: string; session: Session; onChange: () => void }) {
  const [t, setT] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [fromDraft, setFromDraft] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const load = async () => {
    const data = await api(`/api/tickets/${id}`);
    setT((prev: any) => {
      // Only replace the editor text when a new draft arrives, never while someone is typing.
      if (data.draft && (!prev?.draft || prev.draft.body !== data.draft.body)) {
        setReply(data.draft.body);
        setFromDraft(true);
      }
      return data;
    });
    api(`/api/audit?ticket=${data.ref}`).then(setEvents);
  };

  useEffect(() => { load().catch((e) => setError(e.message)); }, [id]);
  useEffect(() => {
    if (t?.status !== 'processing') return;
    const i = setInterval(load, 1500);
    return () => clearInterval(i);
  }, [t?.status]);

  const act = async (name: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(name);
    setError(null);
    try {
      await fn();
      await load();
      onChange();
      if (done) toast.show(done);
    } catch (e: any) { setError(e.message); }
    setBusy(null);
  };

  if (error && !t) return <div className="page"><Notice kind="danger">{error}</Notice></div>;
  if (!t) return <div className="center-screen"><Spinner /></div>;

  const update = (body: object, done?: string) => act('update', () => api(`/api/tickets/${t.id}/update`, { body }), done);
  const who = t.requester.name || t.requester.email || t.requester.phone || 'Requester';
  const draft = t.draft;
  const edited = fromDraft && draft && reply.trim() !== draft.body.trim();

  return (
    <div className="page fade-in" style={{ maxWidth: 1180 }}>
      <div className="stack-sm" style={{ marginBottom: 28 }}>
        <Link to="/app/inbox" className="small" style={{ textDecoration: 'none' }}>← Inbox</Link>
        <div className="row wrap" style={{ alignItems: 'flex-start' }}>
          <h1 style={{ flex: 1, minWidth: 240 }}>{t.subject}</h1>
        </div>
        <div className="row wrap small muted">
          <StatusBadge status={t.status} />
          <span>{who}</span><span className="faint">·</span>
          <span>{CHANNEL_LABEL[t.channel]}</span><span className="faint">·</span>
          <span className="mono">{t.ref}</span><span className="faint">·</span>
          <span>{timeAgo(t.createdAt)}</span>
        </div>
      </div>

      <div className="ticket-layout">
        <div className="stack">
          {t.safety?.flagged && (
            <Notice kind="danger">
              <ShieldIcon />
              <div><strong>This needs a person.</strong> {t.safety.reason} The AI did not write a reply. Please follow your organization's safeguarding procedure.</div>
            </Notice>
          )}

          {t.messages.map((m: any) => (
            <div key={m.id} className={`msg ${m.direction}`}>
              <div className="row small">
                <span style={{ fontWeight: 600 }}>{m.direction === 'in' ? who : m.author === 'ai' ? 'Sent automatically' : m.author}</span>
                <span className="faint">{timeAgo(m.at)}</span>
                <span className="spacer" />
                {m.direction === 'out' && m.aiDrafted && <span className="badge">{m.edited ? 'AI draft, edited' : 'AI draft, approved'}</span>}
                {m.delivery === 'failed' && <span className="badge danger">Not delivered</span>}
              </div>
              <div className="body">{m.body}</div>
              {m.deliveryNote && <div className="xs faint" style={{ marginTop: 10 }}>{m.deliveryNote}</div>}
            </div>
          ))}

          {t.status === 'processing' && (
            <div className="card flat row"><Spinner /><span className="muted">The assistant is reading the message and checking your documents…</span></div>
          )}

          {t.status !== 'processing' && t.status !== 'closed' && (
            <div className="draft-card stack">
              <div className="row">
                {draft ? <><span className="badge accent"><SparkIcon />Suggested reply</span><span className="small faint">{Math.round(draft.confidence * 100)}% confident · {draft.grounded ? 'based on your documents' : 'no matching document'}</span></> : <span className="label">Write a reply</span>}
              </div>
              {draft && !draft.grounded && <Notice kind="warn">The assistant could not find this in your documents, so the draft only says someone will follow up. Consider writing the answer yourself, then add it to Knowledge so next time it can help.</Notice>}
              <textarea className="textarea reply" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Write to ${who}…`} />
              {draft?.citations?.length > 0 && (
                <div className="stack-sm">
                  <div className="small muted">Sources the assistant used</div>
                  <div className="sources">
                    {draft.citations.map((c: any, i: number) => (
                      <div key={i} className="source"><div className="t">[{i + 1}] {c.title}</div><div className="muted">{c.snippet}…</div></div>
                    ))}
                  </div>
                </div>
              )}
              {error && <Notice kind="danger">{error}</Notice>}
              <div className="row wrap">
                <button className="btn primary" disabled={!!busy || !reply.trim()} onClick={() => act('send', () => api(`/api/tickets/${t.id}/send`, { body: { body: reply, fromDraft } }), 'Reply sent')}>
                  {busy === 'send' && <Spinner />}{draft && !edited ? 'Approve and send' : 'Send reply'}
                </button>
                {!t.safety?.flagged && <button className="btn" disabled={!!busy} onClick={() => act('regen', () => api(`/api/tickets/${t.id}/regenerate`, { method: 'POST' }), 'New draft ready')}>{busy === 'regen' && <Spinner />}Write a new draft</button>}
                {draft && <button className="btn ghost" disabled={!!busy} onClick={() => { setReply(''); setFromDraft(false); update({ discardDraft: true }, 'Draft discarded'); }}>Discard draft</button>}
                <span className="spacer" />
                {edited && <span className="xs faint">Edited. Your changes help measure how accurate the assistant is.</span>}
              </div>
            </div>
          )}
        </div>

        <aside className="stack">
          <div className="card flat stack">
            <div className="label">Details</div>
            <dl className="kv">
              <dt>Department</dt>
              <dd><select className="select" style={{ padding: '5px 28px 5px 10px', fontSize: 14 }} value={t.departmentId} onChange={(e) => update({ departmentId: e.target.value }, 'Moved')}>
                {session.org.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select></dd>
              <dt>Urgency</dt>
              <dd><select className="select" style={{ padding: '5px 28px 5px 10px', fontSize: 14 }} value={t.urgency} onChange={(e) => update({ urgency: e.target.value })}>
                {['low', 'normal', 'high', 'urgent'].map((u) => <option key={u} value={u}>{u[0]!.toUpperCase() + u.slice(1)}</option>)}
              </select></dd>
              {t.requester.email && <><dt>Email</dt><dd style={{ wordBreak: 'break-all' }}>{t.requester.email}</dd></>}
              {t.requester.phone && <><dt>Phone</dt><dd>{t.requester.phone}</dd></>}
              {t.category && <><dt>Topic</dt><dd>{t.category}</dd></>}
            </dl>
            <div className="row wrap">
              {t.status !== 'closed'
                ? <button className="btn sm" onClick={() => update({ status: 'closed' }, 'Closed')}>Close conversation</button>
                : <button className="btn sm" onClick={() => update({ status: 'needs_person' }, 'Reopened')}>Reopen</button>}
            </div>
          </div>

          {(t.summary || t.notes?.length > 0) && (
            <div className="card soft stack-sm">
              <div className="label">What the assistant did</div>
              {t.summary && <p className="small"><strong>Summary:</strong> {t.summary}</p>}
              <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
                {t.notes.map((n: string, i: number) => <li key={i}>{n}</li>)}
              </ul>
              {t.model && <div className="xs faint">Assistant: {t.model}</div>}
            </div>
          )}

          <div className="card flat stack-sm">
            <div className="label">History</div>
            {events.slice(0, 12).map((e) => (
              <div key={e.id} className="small"><span className="faint">{timeAgo(e.at)}</span> · {e.detail} <span className="faint">({e.actor})</span></div>
            ))}
          </div>
        </aside>
      </div>
      {toast.node}
    </div>
  );
}
