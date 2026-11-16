import { useState } from 'react';
import { api } from '../api';
import { Field, Notice, Spinner } from '../components/ui';
import type { Session } from './Console';

export default function Account({ session }: { session: Session }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.next !== form.confirm) return setMsg({ ok: false, text: 'The two new passwords do not match.' });
    setBusy(true);
    setMsg(null);
    try {
      await api('/api/auth/password', { body: { current: form.current, next: form.next } });
      setForm({ current: '', next: '', confirm: '' });
      setMsg({ ok: true, text: 'Your password has been changed. Other devices have been signed out.' });
      session.refresh();
    } catch (err: any) { setMsg({ ok: false, text: err.message }); }
    setBusy(false);
  };

  return (
    <div className="page narrow fade-in">
      <div className="page-head"><div><h1>My account</h1><p>{session.user.name} · {session.user.email} · {session.user.role === 'admin' ? 'Administrator' : 'Staff'}</p></div></div>
      {session.user.mustChangePassword && <div style={{ marginBottom: 24 }}><Notice kind="warn">You are using a temporary password. Please choose your own below.</Notice></div>}
      <form className="card flat stack" style={{ maxWidth: 480 }} onSubmit={submit}>
        <h3>Change password</h3>
        <Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} /></Field>
        <Field label="New password" hint="At least 10 characters. A short sentence works well."><input className="input" type="password" autoComplete="new-password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} /></Field>
        <Field label="New password again"><input className="input" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></Field>
        {msg && <Notice kind={msg.ok ? 'ok' : 'danger'}>{msg.text}</Notice>}
        <div><button className="btn primary" disabled={busy || !form.current || !form.next}>{busy && <Spinner />}Change password</button></div>
      </form>
    </div>
  );
}
