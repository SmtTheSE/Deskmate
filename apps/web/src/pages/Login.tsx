import { useEffect, useState } from 'react';
import { api } from '../api';
import { Field, Logo, Notice, Spinner } from '../components/ui';
import { navigate } from '../router';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [orgName, setOrgName] = useState('');

  useEffect(() => {
    api('/api/auth/me').then((r) => r.user && navigate('/app', true));
    api('/api/status').then((s) => setOrgName(s.org?.name ?? ''));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/auth/login', { body: { email, password } });
      navigate('/app');
    } catch (err: any) { setError(err.message); }
    setBusy(false);
  };

  return (
    <div className="center-screen">
      <form className="stack fade-in" style={{ width: '100%', maxWidth: 380 }} onSubmit={submit}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ display: 'inline-block', marginBottom: 20 }}><Logo size={44} /></div>
          <h1>Welcome back</h1>
          <p className="muted" style={{ marginTop: 6 }}>Sign in to {orgName ? `the ${orgName} help desk` : 'your help desk'}.</p>
        </div>
        <Field label="Email" htmlFor="e"><input id="e" className="input" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password" htmlFor="p"><input id="p" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {error && <Notice kind="danger">{error}</Notice>}
        <button className="btn dark lg" disabled={busy}>{busy && <Spinner />}Sign in</button>
        <p className="small faint" style={{ textAlign: 'center' }}>Forgot your password? Ask an administrator to reset it.</p>
      </form>
    </div>
  );
}
