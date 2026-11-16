import { useEffect, useState } from 'react';
import { api } from '../api';
import { Spinner } from '../components/ui';
import { Link } from '../router';

/** The audit log: every AI decision and every human action, in plain language. */
export default function Activity() {
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => { api('/api/audit').then(setItems); }, []);
  return (
    <div className="page narrow fade-in">
      <div className="page-head">
        <div>
          <h1>Activity log</h1>
          <p>A permanent record of what the assistant did and what your team approved, for accountability and audits.</p>
        </div>
      </div>
      {!items ? <Spinner /> : (
        <div className="card flat timeline" style={{ padding: '4px 20px' }}>
          {items.map((e) => (
            <div key={e.id} className="ev">
              <div className="faint small">{new Date(e.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</div>
              <div>
                <div>{e.detail}</div>
                <div className="xs faint" style={{ marginTop: 2 }}>
                  {e.actor === 'ai' ? 'Assistant' : e.actor === 'system' ? 'System' : e.actor}
                  {e.ticketRef && <> · <Link to={`/app/tickets/${e.ticketRef}`}>{e.ticketRef}</Link></>}
                </div>
              </div>
            </div>
          ))}
          {!items.length && <div className="empty">Nothing yet.</div>}
        </div>
      )}
    </div>
  );
}
