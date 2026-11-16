import { useEffect, useState } from 'react';
import { api } from '../api';
import type { TicketSummary } from '../api';
import { CHANNEL_LABEL, Spinner, StatusBadge, UrgencyBadge, timeAgo } from '../components/ui';
import { Link } from '../router';
import type { Session } from './Console';

const FILTERS = [
  { id: 'open', label: 'Waiting' },
  { id: 'needs_review', label: 'Needs review' },
  { id: 'needs_person', label: 'Needs a person' },
  { id: 'replied', label: 'Replied' },
  { id: 'closed', label: 'Closed' },
  { id: '', label: 'Everything' },
];

export function TicketRow({ t, departments }: { t: TicketSummary; departments: Session['org']['departments'] }) {
  const dep = departments.find((d) => d.id === t.departmentId);
  const who = t.requester.name || t.requester.email || t.requester.phone || 'Someone';
  return (
    <Link to={`/app/tickets/${t.id}`} className="list-item">
      <div style={{ minWidth: 0 }}>
        <div className="subject">{t.subject}</div>
        <div className="summary">{who}{t.summary && t.summary !== t.subject ? ` · ${t.summary}` : ''}</div>
        <div className="meta">
          <StatusBadge status={t.status} />
          <UrgencyBadge urgency={t.urgency} />
          {dep && <span className="badge">{dep.name}</span>}
          {t.flagged && <span className="badge danger">Sensitive</span>}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className="small faint">{timeAgo(t.updatedAt)}</div>
        <div className="xs faint" style={{ marginTop: 2 }}>{CHANNEL_LABEL[t.channel]} · {t.ref}</div>
      </div>
    </Link>
  );
}

export default function Inbox({ session }: { session: Session }) {
  const [filter, setFilter] = useState(() => new URLSearchParams(location.search).get('status') ?? 'open');
  const [dep, setDep] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<TicketSummary[] | null>(null);

  useEffect(() => {
    const load = () => {
      const p = new URLSearchParams();
      if (filter) p.set('status', filter);
      if (dep) p.set('department', dep);
      if (q) p.set('q', q);
      api<TicketSummary[]>(`/api/tickets?${p}`).then(setItems);
    };
    load();
    const i = setInterval(load, 8000);
    return () => clearInterval(i);
  }, [filter, dep, q]);

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <h1>Inbox</h1>
          <p>Every message from the help form, email, and text messages. AI drafts wait here until someone approves them.</p>
        </div>
      </div>
      <div className="stack">
        <div className="row wrap">
          <div className="tabs">
            {FILTERS.map((f) => <button key={f.id} className={`tab ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>{f.label}</button>)}
          </div>
          <span className="spacer" />
          <select className="select" style={{ width: 'auto', height: 38, paddingTop: 0, paddingBottom: 0 }} value={dep} onChange={(e) => setDep(e.target.value)}>
            <option value="">All departments</option>
            {session.org.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input className="input" style={{ width: 220, height: 38 }} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!items ? <div className="empty"><Spinner /></div> : items.length ? (
          <div className="list">{items.map((t) => <TicketRow key={t.id} t={t} departments={session.org.departments} />)}</div>
        ) : (
          <div className="card flat empty">
            <h3>{filter === 'open' ? 'Nothing waiting' : 'No conversations here'}</h3>
            <p className="small">Try the <a href="/help" target="_blank" rel="noreferrer">help form</a> to send yourself a test question.</p>
          </div>
        )}
      </div>
    </div>
  );
}
