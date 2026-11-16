import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Department } from '../api';
import { Field, Notice, Spinner, TestButton, useToast } from '../components/ui';
import type { Session } from './Console';

const TABS = [
  { id: 'org', label: 'Organization' },
  { id: 'ai', label: 'AI assistant' },
  { id: 'channels', label: 'Channels' },
  { id: 'safety', label: 'Privacy and safety' },
  { id: 'team', label: 'Team' },
];

export default function Settings({ session }: { session: Session }) {
  const [tab, setTab] = useState('org');
  const [s, setS] = useState<any>(null);
  const [opts, setOpts] = useState<any>(null);
  const [secrets, setSecrets] = useState({ apiKey: '', smtpPass: '', authToken: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const load = () => api('/api/settings').then(setS);
  useEffect(() => { load(); api('/api/setup/options').then(setOpts); }, []);
  if (!s || !opts) return <div className="center-screen"><Spinner /></div>;

  const save = async (body: object) => {
    setSaving(true);
    setError(null);
    try {
      await api('/api/settings', { method: 'PUT', body });
      setSecrets({ apiKey: '', smtpPass: '', authToken: '' });
      await load();
      session.refresh();
      toast.show('Saved');
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };
  const setDeps = (departments: Department[]) => setS({ ...s, org: { ...s.org, departments } });
  const SaveBtn = ({ body }: { body: () => object }) => (
    <div className="row"><button className="btn primary" disabled={saving} onClick={() => save(body())}>{saving && <Spinner />}Save changes</button></div>
  );

  return (
    <div className="page narrow fade-in">
      <div className="page-head"><div><h1>Settings</h1><p>Changes apply straight away. Every change is recorded in the activity log.</p></div></div>
      <div className="stack-lg">
        <div className="tabs">{TABS.map((t) => <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
        {error && <Notice kind="danger">{error}</Notice>}

        {tab === 'org' && (
          <div className="stack-lg">
            <div className="stack">
              <Field label="Organization name"><input className="input" value={s.org.name} onChange={(e) => setS({ ...s, org: { ...s.org, name: e.target.value } })} /></Field>
              <Field label="Reply signature"><input className="input" value={s.org.signature} onChange={(e) => setS({ ...s, org: { ...s.org, signature: e.target.value } })} /></Field>
            </div>
            <div className="stack">
              <div><h3>Departments</h3><p className="small muted" style={{ marginTop: 4 }}>Every department starts with a person approving each reply. Once you trust the drafts, you can let a department send confident, sourced answers on its own.</p></div>
              {s.org.departments.map((d: Department, i: number) => (
                <div key={i} className="card flat tight stack-sm">
                  <div className="dept-row">
                    <input className="input" value={d.name} placeholder="Name" onChange={(e) => setDeps(s.org.departments.map((x: Department, j: number) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    <input className="input" value={d.description} placeholder="What they handle" onChange={(e) => setDeps(s.org.departments.map((x: Department, j: number) => (j === i ? { ...x, description: e.target.value } : x)))} />
                    <button className="btn ghost sm" onClick={() => setDeps(s.org.departments.filter((_: unknown, j: number) => j !== i))}>Remove</button>
                  </div>
                  <input className="input" style={{ fontSize: 13 }} placeholder="Words that usually mean this department" value={d.keywords.join(', ')} onChange={(e) => setDeps(s.org.departments.map((x: Department, j: number) => (j === i ? { ...x, keywords: e.target.value.split(',').map((k) => k.trim()) } : x)))} />
                  <label className="check small">
                    <input type="checkbox" checked={d.mode === 'auto'} onChange={(e) => setDeps(s.org.departments.map((x: Department, j: number) => (j === i ? { ...x, mode: e.target.checked ? 'auto' : 'approval' } : x)))} />
                    <span>Send confident answers automatically <span className="faint">(only when the answer comes from your documents; sensitive messages always go to a person)</span></span>
                  </label>
                </div>
              ))}
              <div><button className="btn" onClick={() => setDeps([...s.org.departments, { id: '', name: '', description: '', keywords: [], mode: 'approval' }])}>+ Add a department</button></div>
            </div>
            <SaveBtn body={() => ({ org: s.org })} />
          </div>
        )}

        {tab === 'ai' && (
          <div className="stack-lg">
            <div className="grid-2">
              {opts.models.map((m: any) => (
                <button key={m.provider} type="button" className={`choice ${s.model.provider === m.provider ? 'selected' : ''}`} onClick={() => setS({ ...s, model: { ...s.model, provider: m.provider, model: m.defaultModel ?? '', baseUrl: '' } })}>
                  <span className="title">{m.title}</span><span className="blurb">{m.blurb}</span>
                </button>
              ))}
            </div>
            {s.model.provider !== 'mock' && (
              <div className="card flat stack">
                {s.model.provider !== 'ollama' && (
                  <Field label="Key" hint={s.model.hasKey ? 'A key is saved. Leave empty to keep it.' : 'Paste your key. It is stored encrypted.'}>
                    <input className="input mono" type="password" autoComplete="off" placeholder={s.model.hasKey ? '••••••••••••' : 'Paste your key'} value={secrets.apiKey} onChange={(e) => setSecrets({ ...secrets, apiKey: e.target.value })} />
                  </Field>
                )}
                {s.model.provider === 'ollama' && <Field label="Server address"><input className="input mono" placeholder="http://localhost:11434" value={s.model.baseUrl ?? ''} onChange={(e) => setS({ ...s, model: { ...s.model, baseUrl: e.target.value } })} /></Field>}
                <Field label="Model name"><input className="input mono" value={s.model.model ?? ''} onChange={(e) => setS({ ...s, model: { ...s.model, model: e.target.value } })} /></Field>
                <TestButton path="/api/setup/test/model" body={() => ({ ...s.model, apiKey: secrets.apiKey })} />
              </div>
            )}
            <SaveBtn body={() => ({ model: { ...s.model, apiKey: secrets.apiKey } })} />
          </div>
        )}

        {tab === 'channels' && (
          <div className="stack-lg">
            <div className="card flat stack-sm">
              <div className="label">Help form link</div>
              <code>{s.webhooks.helpForm}</code>
              <div className="hint">Share this anywhere: your website, newsletters, posters.</div>
            </div>
            <div className="card flat stack">
              <label className="check"><input type="checkbox" checked={s.email.enabled} onChange={(e) => setS({ ...s, email: { ...s.email, enabled: e.target.checked } })} /><span style={{ fontWeight: 600 }}>Send replies by email</span></label>
              <div className="grid-2">
                <Field label="Mail server"><input className="input" value={s.email.smtpHost ?? ''} onChange={(e) => setS({ ...s, email: { ...s.email, smtpHost: e.target.value } })} /></Field>
                <Field label="Port"><input className="input" value={s.email.smtpPort ?? ''} onChange={(e) => setS({ ...s, email: { ...s.email, smtpPort: e.target.value } })} /></Field>
                <Field label="Username"><input className="input" value={s.email.smtpUser ?? ''} onChange={(e) => setS({ ...s, email: { ...s.email, smtpUser: e.target.value } })} /></Field>
                <Field label="Password" hint={s.email.hasPassword ? 'Saved. Leave empty to keep it.' : undefined}><input className="input" type="password" autoComplete="new-password" value={secrets.smtpPass} onChange={(e) => setSecrets({ ...secrets, smtpPass: e.target.value })} /></Field>
              </div>
              <Field label="Send replies from"><input className="input" value={s.email.fromAddress ?? ''} onChange={(e) => setS({ ...s, email: { ...s.email, fromAddress: e.target.value } })} /></Field>
              <TestButton path="/api/setup/test/email" body={() => ({ ...s.email, smtpPass: secrets.smtpPass })} />
              <div className="stack-sm">
                <div className="label">Receiving email</div>
                <div className="hint">To turn incoming emails into conversations, ask your email provider (or IT team) to forward incoming mail as JSON to this address. Postmark, Mailgun and n8n can all do this.</div>
                <code style={{ wordBreak: 'break-all', fontSize: 13 }}>{s.webhooks.email}</code>
              </div>
            </div>
            <div className="card flat stack">
              <label className="check"><input type="checkbox" checked={s.twilio.enabled} onChange={(e) => setS({ ...s, twilio: { ...s.twilio, enabled: e.target.checked } })} /><span style={{ fontWeight: 600 }}>Text messages and WhatsApp (Twilio)</span></label>
              <div className="grid-2">
                <Field label="Account SID"><input className="input mono" value={s.twilio.accountSid ?? ''} onChange={(e) => setS({ ...s, twilio: { ...s.twilio, accountSid: e.target.value } })} /></Field>
                <Field label="Auth Token" hint={s.twilio.hasToken ? 'Saved. Leave empty to keep it.' : undefined}><input className="input mono" type="password" autoComplete="off" value={secrets.authToken} onChange={(e) => setSecrets({ ...secrets, authToken: e.target.value })} /></Field>
                <Field label="Text message number"><input className="input" value={s.twilio.smsNumber ?? ''} onChange={(e) => setS({ ...s, twilio: { ...s.twilio, smsNumber: e.target.value } })} /></Field>
                <Field label="WhatsApp number"><input className="input" value={s.twilio.whatsappNumber ?? ''} onChange={(e) => setS({ ...s, twilio: { ...s.twilio, whatsappNumber: e.target.value } })} /></Field>
              </div>
              <TestButton path="/api/setup/test/twilio" body={() => ({ ...s.twilio, authToken: secrets.authToken })} />
              <div className="stack-sm">
                <div className="label">One last step in Twilio</div>
                <div className="hint">In the Twilio console, open your phone number, find “A message comes in”, and paste this link:</div>
                <code style={{ fontSize: 13 }}>{s.webhooks.twilio}</code>
              </div>
            </div>
            <SaveBtn body={() => ({ email: { ...s.email, smtpPass: secrets.smtpPass }, twilio: { ...s.twilio, authToken: secrets.authToken } })} />
          </div>
        )}

        {tab === 'safety' && (
          <div className="stack-lg">
            <div className="card soft stack-sm">
              <div className="label">Always on</div>
              <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
                <li>Names, emails, phone numbers, card numbers and ID numbers are hidden before anything reaches the AI.</li>
                <li>Messages that mention self-harm, abuse, violence or emergencies go straight to a person with no AI reply.</li>
                <li>The assistant only answers from your documents and says so when it doesn't know.</li>
                <li>Every action is recorded in the activity log.</li>
              </ul>
            </div>
            <Field label="Extra words that should always go to a person" hint="One per line. For example: exclusion, complaint, lawyer, data request.">
              <textarea className="textarea" value={s.policy.sensitivePhrases.join('\n')} onChange={(e) => setS({ ...s, policy: { ...s.policy, sensitivePhrases: e.target.value.split('\n') } })} />
            </Field>
            <Field label={`Confidence needed to send automatically: ${Math.round(s.policy.autoSendMinConfidence * 100)}%`} hint="Only applies to departments where you've turned on automatic replies.">
              <input type="range" min={0.5} max={0.99} step={0.01} value={s.policy.autoSendMinConfidence} onChange={(e) => setS({ ...s, policy: { ...s.policy, autoSendMinConfidence: Number(e.target.value) } })} style={{ accentColor: 'var(--accent)' }} />
            </Field>
            <SaveBtn body={() => ({ policy: { ...s.policy, sensitivePhrases: s.policy.sensitivePhrases.filter((p: string) => p.trim()) } })} />
          </div>
        )}

        {tab === 'team' && <Team />}
      </div>
      {toast.node}
    </div>
  );
}

function Team() {
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', email: '', role: 'staff' });
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => api('/api/users').then(setUsers);
  useEffect(() => { load(); }, []);
  return (
    <div className="stack-lg">
      <div className="list">
        {users.map((u) => (
          <div key={u.id} className="list-item" style={{ alignItems: 'center' }}>
            <div><div className="subject">{u.name}</div><div className="summary">{u.email}</div></div>
            <span className="badge">{u.role === 'admin' ? 'Administrator' : 'Staff'}</span>
          </div>
        ))}
      </div>
      <div className="card flat stack">
        <h3>Invite a colleague</h3>
        <div className="grid-2">
          <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        </div>
        <Field label="Role">
          <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="staff">Staff: can answer conversations and manage documents</option>
            <option value="admin">Administrator: can also change settings and invite people</option>
          </select>
        </Field>
        {error && <Notice kind="danger">{error}</Notice>}
        {created && <Notice kind="ok">Account created. Give {created.email} this temporary password: <strong className="mono">{created.tempPassword}</strong></Notice>}
        <div><button className="btn primary" onClick={async () => {
          setError(null);
          try { const r = await api('/api/users', { body: form }); setCreated({ email: r.user.email, tempPassword: r.tempPassword }); setForm({ name: '', email: '', role: 'staff' }); load(); } catch (e: any) { setError(e.message); }
        }}>Add to team</button></div>
      </div>
    </div>
  );
}
