import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Department } from '../api';
import { BookIcon, ClockIcon, GearIcon, HomeIcon, InboxIcon, Logo, MenuIcon, Spinner } from '../components/ui';
import { Link, navigate } from '../router';
import Home from './Home';
import Inbox from './Inbox';
import TicketView from './TicketView';
import Knowledge from './Knowledge';
import Settings from './Settings';
import Activity from './Activity';

export interface Session {
  user: { id: string; name: string; email: string; role: 'admin' | 'staff' };
  org: { name: string; departments: Pick<Department, 'id' | 'name' | 'description'>[] };
  refresh: () => void;
}

export default function Console({ path }: { path: string }) {
  const [session, setSession] = useState<Omit<Session, 'refresh'> | null>(null);
  const [counts, setCounts] = useState({ needsReview: 0, needsPerson: 0 });
  const [menuOpen, setMenuOpen] = useState(false);

  const load = async () => {
    const me = await api('/api/auth/me');
    if (!me.user) return navigate('/login', true);
    const status = await api('/api/status');
    setSession({ user: me.user, org: status.org });
  };
  const loadCounts = () => api('/api/stats').then((s) => setCounts({ needsReview: s.needsReview, needsPerson: s.needsPerson })).catch(() => {});

  useEffect(() => { load(); }, []);
  useEffect(() => { loadCounts(); const i = setInterval(loadCounts, 10000); return () => clearInterval(i); }, [path]);
  useEffect(() => setMenuOpen(false), [path]);

  if (!session) return <div className="center-screen"><Spinner /></div>;
  const ctx: Session = { ...session, refresh: load };
  const parts = path.split('/').filter(Boolean);

  const nav = [
    { to: '/app', label: 'Home', icon: <HomeIcon />, active: parts.length === 1 },
    { to: '/app/inbox', label: 'Inbox', icon: <InboxIcon />, active: parts[1] === 'inbox' || parts[1] === 'tickets', count: counts.needsReview + counts.needsPerson },
    { to: '/app/knowledge', label: 'Knowledge', icon: <BookIcon />, active: parts[1] === 'knowledge' },
    { to: '/app/activity', label: 'Activity log', icon: <ClockIcon />, active: parts[1] === 'activity' },
    ...(session.user.role === 'admin' ? [{ to: '/app/settings', label: 'Settings', icon: <GearIcon />, active: parts[1] === 'settings' }] : []),
  ];

  let page;
  if (parts[1] === 'inbox') page = <Inbox session={ctx} />;
  else if (parts[1] === 'tickets' && parts[2]) page = <TicketView key={parts[2]} id={parts[2]} session={ctx} onChange={loadCounts} />;
  else if (parts[1] === 'knowledge') page = <Knowledge />;
  else if (parts[1] === 'settings') page = <Settings session={ctx} />;
  else if (parts[1] === 'activity') page = <Activity />;
  else page = <Home session={ctx} />;

  return (
    <div className="app">
      <div className="mobile-bar">
        <button className="btn ghost sm" aria-label="Menu" onClick={() => setMenuOpen(!menuOpen)}><MenuIcon /></button>
        <span className="serif">{session.org.name}</span>
      </div>
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="org">
          <Logo />
          <div>
            <div className="org-name">{session.org.name}</div>
            <div className="xs faint">Help desk</div>
          </div>
        </div>
        {nav.map((n) => (
          <Link key={n.to} to={n.to} className={`nav-item ${n.active ? 'active' : ''}`}>
            {n.icon}
            {n.label}
            {n.count ? <span className="count">{n.count}</span> : null}
          </Link>
        ))}
        <div className="nav-section">Share</div>
        <a className="nav-item" href="/help" target="_blank" rel="noreferrer">Open the help form ↗</a>
        <div className="footer">
          <div className="nav-item" style={{ cursor: 'default' }}>
            <span className="logo" style={{ background: 'var(--text)', color: 'var(--bg)', width: 28, height: 28, borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
              {session.user.name.slice(0, 1).toUpperCase()}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.user.name}</div>
              <div className="xs faint">{session.user.role === 'admin' ? 'Administrator' : 'Staff'}</div>
            </div>
          </div>
          <button className="btn ghost sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={async () => { await api('/api/auth/logout', { method: 'POST' }); navigate('/login'); }}>Sign out</button>
        </div>
      </aside>
      <main className="main">{page}</main>
    </div>
  );
}
