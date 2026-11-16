import { useEffect, useState } from 'react';
import { api } from '../api';
import type { TicketSummary } from '../api';
import { Spinner } from '../components/ui';
import { Link } from '../router';
import type { Session } from './Console';
import { TicketRow } from './Inbox';

export default function Home({ session }: { session: Session }) {
  const [stats, setStats] = useState<any>(null);
  const [queue, setQueue] = useState<TicketSummary[]>([]);

  useEffect(() => {
    api('/api/stats').then(setStats);
    api<TicketSummary[]>('/api/tickets?status=open').then(setQueue);
  }, []);

  if (!stats) return <div className="center-screen"><Spinner /></div>;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const approvalRate = stats.aiReplies ? Math.round((stats.approvedAsWritten / stats.aiReplies) * 100) : null;
  const maxDep = Math.max(1, ...stats.byDepartment.map((d: any) => d.count));
  const waiting = stats.needsReview + stats.needsPerson;

  return (
    <div className="page fade-in">
      <div className="stack-lg">
        <div>
          <h1 style={{ fontSize: 34 }}>{greeting}, {session.user.name.split(' ')[0]}</h1>
          <p className="muted" style={{ fontSize: 17, marginTop: 6 }}>
            {waiting === 0 ? 'Nothing is waiting for you right now.' : `${waiting} conversation${waiting > 1 ? 's are' : ' is'} waiting for you.`}
          </p>
        </div>

        <div className="grid-3">
          <div className="card stat"><div className="label">Waiting for review</div><div className="value">{stats.needsReview}</div><div className="xs faint">AI drafts ready to approve</div></div>
          <div className="card stat"><div className="label">Need a person</div><div className="value" style={{ color: stats.needsPerson ? 'var(--danger)' : undefined }}>{stats.needsPerson}</div><div className="xs faint">Sensitive or unanswered</div></div>
          <div className="card stat"><div className="label">Questions answered</div><div className="value">{stats.replied}</div><div className="xs faint">{stats.thisWeek} new this week</div></div>
          <div className="card stat"><div className="label">Drafts approved as written</div><div className="value">{approvalRate === null ? '—' : `${approvalRate}%`}</div><div className="xs faint">Higher means the AI is getting it right</div></div>
          <div className="card stat"><div className="label">Typical time to first reply</div><div className="value">{stats.medianFirstReplyMinutes === null ? '—' : formatMinutes(stats.medianFirstReplyMinutes)}</div><div className="xs faint">Half of replies were faster than this</div></div>
          <div className="card stat"><div className="label">Documents</div><div className="value">{stats.documents}</div><div className="xs faint"><Link to="/app/knowledge">Add more</Link> to answer more questions</div></div>
        </div>

        <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)' }}>
          <div className="stack-sm">
            <div className="row"><h3>Waiting for you</h3><span className="spacer" /><Link to="/app/inbox" className="small">See all</Link></div>
            {queue.length ? (
              <div className="list">{queue.slice(0, 6).map((t) => <TicketRow key={t.id} t={t} departments={session.org.departments} />)}</div>
            ) : (
              <div className="card flat empty"><h3>All caught up</h3><p className="small">New messages will appear here. <a href="/help" target="_blank" rel="noreferrer">Send a test message</a> to see how it works.</p></div>
            )}
          </div>
          <div className="stack-sm">
            <h3>By department</h3>
            <div className="card flat stack">
              {stats.byDepartment.map((d: any) => (
                <div key={d.id} className="stack-sm" style={{ gap: 6 }}>
                  <div className="row small"><span>{d.name}</span><span className="spacer" /><span className="faint">{d.count}</span></div>
                  <div className="bar"><span style={{ width: `${(d.count / maxDep) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatMinutes(m: number) {
  if (m < 60) return `${m} min`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h`;
  return `${Math.round(m / 1440)} days`;
}
