import { useEffect, useState } from 'react';
import { api, fileToBase64 } from '../api';
import type { Department } from '../api';
import { Dropzone, Field, Logo, Notice, Spinner, TestButton } from '../components/ui';
import { navigate } from '../router';

interface Options {
  templates: { id: string; title: string; blurb: string; departments: Department[]; starterDocs: string[] }[];
  models: { provider: string; title: string; blurb: string; needsKey: boolean; defaultModel?: string }[];
}

const STEPS = ['Welcome', 'Your organization', 'Departments', 'AI assistant', 'Channels', 'Knowledge', 'Your account', 'Finish'];

export default function Setup() {
  const [opts, setOpts] = useState<Options | null>(null);
  const [step, setStep] = useState(0);
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('code') ?? '');
  const [codeOk, setCodeOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [org, setOrg] = useState({ name: '', template: 'school', signature: '' });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [model, setModel] = useState({ provider: 'mock', apiKey: '', model: '', baseUrl: '' });
  const [email, setEmail] = useState({ enabled: false, smtpHost: '', smtpPort: '587', smtpUser: '', smtpPass: '', fromAddress: '' });
  const [twilio, setTwilio] = useState({ enabled: false, accountSid: '', authToken: '', smsNumber: '', whatsappNumber: '' });
  const [starterDocs, setStarterDocs] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [admin, setAdmin] = useState({ name: '', email: '', password: '' });
  const [done, setDone] = useState<{ uploaded: number; failed: string[] } | null>(null);

  useEffect(() => {
    api('/api/status').then((s) => { if (s.configured) navigate('/login', true); });
    api<Options>('/api/setup/options').then(setOpts);
  }, []);

  const template = opts?.templates.find((t) => t.id === org.template);
  useEffect(() => { if (template) setDepartments(template.departments.map((d) => ({ ...d }))); }, [template?.id]);

  const go = (n: number) => { setError(null); setStep(n); window.scrollTo(0, 0); };

  const checkCode = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('/api/setup/check-code', { body: { setupCode: code } });
      setCodeOk(true);
      go(1);
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  };

  const validate = (): string | null => {
    if (step === 1 && !org.name.trim()) return 'Please enter your organization\'s name.';
    if (step === 2 && !departments.some((d) => d.name.trim())) return 'Add at least one department.';
    if (step === 3 && model.provider !== 'mock' && model.provider !== 'ollama' && !model.apiKey.trim()) return 'Paste your key, or choose the built-in assistant for now.';
    if (step === 6) {
      if (!admin.name.trim()) return 'Please enter your name.';
      if (!/^\S+@\S+\.\S+$/.test(admin.email)) return 'Please enter a valid email address.';
      if (admin.password.length < 10) return 'Please choose a password with at least 10 characters.';
    }
    return null;
  };

  const next = () => {
    const v = validate();
    if (v) return setError(v);
    go(step + 1);
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('/api/setup/complete', {
        body: {
          setupCode: code,
          org: { ...org, departments: departments.filter((d) => d.name.trim()) },
          model,
          email: { ...email, smtpPort: Number(email.smtpPort) },
          twilio,
          starterDocs,
          admin,
        },
      });
      let uploaded = 0;
      const failed: string[] = [];
      for (const f of files) {
        try {
          await api('/api/knowledge', { body: { filename: f.name, base64: await fileToBase64(f) } });
          uploaded++;
        } catch (e: any) { failed.push(`${f.name}: ${e.message}`); }
      }
      setDone({ uploaded, failed });
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  };

  if (!opts) return <div className="center-screen"><Spinner /></div>;

  if (done) {
    return (
      <div className="wizard"><div className="wizard-inner fade-in">
        <div className="wizard-top"><div className="row"><Logo /><span className="serif" style={{ fontSize: 18 }}>Deskmate</span></div></div>
        <h1>{org.name} is ready.</h1>
        <p className="lede">Your help desk is set up. Every AI reply will wait for a person to approve it before anything is sent.</p>
        {done.failed.length > 0 && <Notice kind="warn">Some files could not be added: {done.failed.join('; ')}. You can try again from the Knowledge page.</Notice>}
        <div className="stack" style={{ marginTop: 24 }}>
          <div className="card flat">
            <div className="stack-sm">
              <div className="label">Share this link so people can ask for help</div>
              <code style={{ fontSize: 15 }}>{location.origin}/help</code>
              <div className="hint">Put it on your website, in your email signature, or on a poster as a QR code.</div>
            </div>
          </div>
          <div className="row wrap">
            <button className="btn primary lg" onClick={() => { location.href = '/app'; }}>Open my help desk</button>
            <a className="btn lg" href="/help" target="_blank" rel="noreferrer">Try the help form</a>
          </div>
        </div>
      </div></div>
    );
  }

  return (
    <div className="wizard">
      <div className="wizard-inner">
        <div className="wizard-top">
          <div className="row"><Logo /><span className="serif" style={{ fontSize: 18 }}>Deskmate</span></div>
          <div className="row">
            <span className="faint small">{step > 0 ? `Step ${step} of ${STEPS.length - 1}` : ''}</span>
            <div className="steps" aria-hidden>{STEPS.slice(1).map((_, i) => <span key={i} className={i + 1 < step ? 'done' : i + 1 === step ? 'current' : ''} />)}</div>
          </div>
        </div>

        <div className="fade-in" key={step}>
          {step === 0 && (
            <>
              <h1>Let's set up your help desk.</h1>
              <p className="lede">This takes about ten minutes. You don't need any technical knowledge, and you can change everything later in Settings.</p>
              <div className="stack">
                <div className="grid-3">
                  {[
                    ['Answers from your documents', 'Replies are written from your own handbooks and policies, with sources.'],
                    ['A person approves every reply', 'Nothing is sent until someone on your team says it\'s right.'],
                    ['Private by design', 'Names, emails and phone numbers are hidden from the AI.'],
                  ].map(([t, b]) => (
                    <div key={t} className="card soft tight"><div style={{ fontWeight: 600, marginBottom: 4 }}>{t}</div><div className="small muted">{b}</div></div>
                  ))}
                </div>
                <Field label="Setup code" hint="The code you chose when deploying to the cloud, or the one shown when Deskmate was installed (also saved in data/setup-code.txt)." htmlFor="code">
                  <input id="code" className="input mono" style={{ maxWidth: 220, letterSpacing: '0.08em' }} placeholder="ABCD-1234" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && checkCode()} />
                </Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1>Tell us about your organization.</h1>
              <p className="lede">We'll use this to suggest departments and to sign your replies.</p>
              <div className="stack-lg">
                <div className="stack">
                  <Field label="Organization name" htmlFor="org">
                    <input id="org" className="input" autoFocus placeholder="e.g. Lincoln High School" value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} />
                  </Field>
                  <Field label="How should replies be signed?" hint="Leave empty to use “The [organization] team”." htmlFor="sig">
                    <input id="sig" className="input" placeholder={`The ${org.name || 'Lincoln High'} team`} value={org.signature} onChange={(e) => setOrg({ ...org, signature: e.target.value })} />
                  </Field>
                </div>
                <div className="stack-sm">
                  <div className="label">What kind of organization are you?</div>
                  <div className="grid-2">
                    {opts.templates.map((t) => (
                      <button key={t.id} type="button" className={`choice ${org.template === t.id ? 'selected' : ''}`} onClick={() => setOrg({ ...org, template: t.id })}>
                        <span className="title">{t.title}</span>
                        <span className="blurb">{t.blurb}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1>Who handles what?</h1>
              <p className="lede">Each message is sorted into one of these departments. Rename, remove, or add your own.</p>
              <div className="stack">
                {departments.map((d, i) => (
                  <div key={i} className="card tight flat stack-sm">
                    <div className="dept-row">
                      <input className="input" aria-label="Department name" placeholder="Department name" value={d.name} onChange={(e) => setDepartments(departments.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      <input className="input" aria-label="What they handle" placeholder="What they handle" value={d.description} onChange={(e) => setDepartments(departments.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                      <button type="button" className="btn ghost sm" onClick={() => setDepartments(departments.filter((_, j) => j !== i))}>Remove</button>
                    </div>
                    <input className="input small" style={{ fontSize: 13 }} aria-label="Words that usually mean this department" placeholder="Words that usually mean this department, separated by commas" value={d.keywords.join(', ')} onChange={(e) => setDepartments(departments.map((x, j) => (j === i ? { ...x, keywords: e.target.value.split(',').map((k) => k.trim()) } : x)))} />
                  </div>
                ))}
                <div><button type="button" className="btn" onClick={() => setDepartments([...departments, { id: '', name: '', description: '', keywords: [], mode: 'approval' }])}>+ Add a department</button></div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1>Choose your AI assistant.</h1>
              <p className="lede">The assistant sorts messages and drafts replies. Start with the built-in one if you're not sure. You can switch any time.</p>
              <div className="stack-lg">
                <div className="grid-2">
                  {opts.models.map((m) => (
                    <button key={m.provider} type="button" className={`choice ${model.provider === m.provider ? 'selected' : ''}`} onClick={() => setModel({ provider: m.provider, apiKey: '', model: m.defaultModel ?? '', baseUrl: '' })}>
                      <span className="title">{m.title}{m.provider === 'mock' && <span className="badge accent" style={{ marginLeft: 8 }}>Recommended to start</span>}</span>
                      <span className="blurb">{m.blurb}</span>
                    </button>
                  ))}
                </div>
                {model.provider !== 'mock' && (
                  <div className="card flat stack">
                    {model.provider !== 'ollama' && (
                      <Field label={`${model.provider === 'openai' ? 'OpenAI' : 'Anthropic'} key`} hint={<>Find it in your {model.provider === 'openai' ? <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">OpenAI dashboard</a> : <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">Anthropic console</a>}. It is stored encrypted and never shown again.</>} htmlFor="key">
                        <input id="key" className="input mono" type="password" autoComplete="off" placeholder="Paste your key here" value={model.apiKey} onChange={(e) => setModel({ ...model, apiKey: e.target.value })} />
                      </Field>
                    )}
                    {model.provider === 'ollama' && (
                      <Field label="Address of your local model server" hint="Ask your IT team. If Deskmate and Ollama run on the same computer with Docker, use http://ollama:11434." htmlFor="base">
                        <input id="base" className="input mono" placeholder="http://localhost:11434" value={model.baseUrl} onChange={(e) => setModel({ ...model, baseUrl: e.target.value })} />
                      </Field>
                    )}
                    <Field label="Model name" hint="The default is a good balance of quality and cost." htmlFor="model">
                      <input id="model" className="input mono" value={model.model} onChange={(e) => setModel({ ...model, model: e.target.value })} />
                    </Field>
                    <TestButton path="/api/setup/test/model" body={() => ({ ...model, setupCode: code })} />
                  </div>
                )}
                {model.provider === 'mock' && <Notice>The built-in assistant runs entirely on your own server. It sorts messages by keywords and replies by quoting the most relevant parts of your documents.</Notice>}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h1>How will people reach you?</h1>
              <p className="lede">The web form works right away. Email and text messages are optional and can be added later.</p>
              <div className="stack">
                <div className="card flat stack-sm">
                  <div className="row"><span style={{ fontWeight: 600 }}>Web help form</span><span className="badge ok"><span className="dot" />Always on</span></div>
                  <div className="small muted">A simple page where anyone can send a question. Its address will be <code>{location.origin}/help</code></div>
                </div>

                <div className="card flat stack">
                  <label className="check">
                    <input type="checkbox" checked={email.enabled} onChange={(e) => setEmail({ ...email, enabled: e.target.checked })} />
                    <span><span style={{ fontWeight: 600 }}>Send replies by email</span><br /><span className="small muted">Use your organization's email account to send replies. Your IT team or email provider can give you these details.</span></span>
                  </label>
                  {email.enabled && (
                    <div className="stack">
                      <div className="grid-2">
                        <Field label="Mail server" hint="e.g. smtp.gmail.com or smtp.office365.com"><input className="input" value={email.smtpHost} onChange={(e) => setEmail({ ...email, smtpHost: e.target.value })} /></Field>
                        <Field label="Port" hint="Usually 587"><input className="input" value={email.smtpPort} onChange={(e) => setEmail({ ...email, smtpPort: e.target.value })} /></Field>
                        <Field label="Username"><input className="input" autoComplete="off" value={email.smtpUser} onChange={(e) => setEmail({ ...email, smtpUser: e.target.value })} /></Field>
                        <Field label="Password" hint="Some providers need an “app password”."><input className="input" type="password" autoComplete="new-password" value={email.smtpPass} onChange={(e) => setEmail({ ...email, smtpPass: e.target.value })} /></Field>
                      </div>
                      <Field label="Send replies from" hint="e.g. help@yourschool.org"><input className="input" value={email.fromAddress} onChange={(e) => setEmail({ ...email, fromAddress: e.target.value })} /></Field>
                      <TestButton path="/api/setup/test/email" body={() => ({ ...email, setupCode: code })} />
                    </div>
                  )}
                </div>

                <div className="card flat stack">
                  <label className="check">
                    <input type="checkbox" checked={twilio.enabled} onChange={(e) => setTwilio({ ...twilio, enabled: e.target.checked })} />
                    <span><span style={{ fontWeight: 600 }}>Text messages and WhatsApp</span> <span className="badge">Optional</span><br /><span className="small muted">Uses a Twilio account. Copy the Account SID and Auth Token from the front page of your Twilio console.</span></span>
                  </label>
                  {twilio.enabled && (
                    <div className="stack">
                      <div className="grid-2">
                        <Field label="Account SID"><input className="input mono" autoComplete="off" placeholder="AC…" value={twilio.accountSid} onChange={(e) => setTwilio({ ...twilio, accountSid: e.target.value })} /></Field>
                        <Field label="Auth Token"><input className="input mono" type="password" autoComplete="off" value={twilio.authToken} onChange={(e) => setTwilio({ ...twilio, authToken: e.target.value })} /></Field>
                        <Field label="Text message number" hint="Your Twilio number, e.g. +14155550100"><input className="input" value={twilio.smsNumber} onChange={(e) => setTwilio({ ...twilio, smsNumber: e.target.value })} /></Field>
                        <Field label="WhatsApp number" hint="Leave empty if you don't use WhatsApp"><input className="input" value={twilio.whatsappNumber} onChange={(e) => setTwilio({ ...twilio, whatsappNumber: e.target.value })} /></Field>
                      </div>
                      <TestButton path="/api/setup/test/twilio" body={() => ({ ...twilio, setupCode: code })} />
                      <div className="hint">After setup, Settings shows the one link to paste into Twilio so incoming messages reach you.</div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <h1>What should your assistant know?</h1>
              <p className="lede">Add the documents people usually ask about: handbooks, policies, FAQs, term dates. Replies will only use what's in here.</p>
              <div className="stack">
                <Dropzone onFiles={(fs) => setFiles([...files, ...fs])} />
                {files.length > 0 && (
                  <div className="list">
                    {files.map((f, i) => (
                      <div key={i} className="list-item" style={{ alignItems: 'center' }}>
                        <div><div className="subject">{f.name}</div><div className="summary">{(f.size / 1024).toFixed(0)} KB · will be added when you finish</div></div>
                        <button className="btn ghost sm" onClick={() => setFiles(files.filter((_, j) => j !== i))}>Remove</button>
                      </div>
                    ))}
                  </div>
                )}
                {template && template.starterDocs.length > 0 && (
                  <label className="check card soft tight">
                    <input type="checkbox" checked={starterDocs} onChange={(e) => setStarterDocs(e.target.checked)} />
                    <span><span style={{ fontWeight: 600 }}>Add example documents so I can try it out</span><br /><span className="small muted">{template.starterDocs.join(', ')}. Delete them any time.</span></span>
                  </label>
                )}
              </div>
            </>
          )}

          {step === 6 && (
            <>
              <h1>Create your account.</h1>
              <p className="lede">You'll be the administrator. You can invite colleagues once you're in.</p>
              <div className="stack" style={{ maxWidth: 440 }}>
                <Field label="Your name" htmlFor="an"><input id="an" className="input" autoComplete="name" value={admin.name} onChange={(e) => setAdmin({ ...admin, name: e.target.value })} /></Field>
                <Field label="Email" htmlFor="ae"><input id="ae" className="input" type="email" autoComplete="email" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} /></Field>
                <Field label="Password" hint="At least 10 characters. A short sentence works well." htmlFor="ap"><input id="ap" className="input" type="password" autoComplete="new-password" value={admin.password} onChange={(e) => setAdmin({ ...admin, password: e.target.value })} /></Field>
              </div>
            </>
          )}

          {step === 7 && (
            <>
              <h1>Ready when you are.</h1>
              <p className="lede">Here's a summary. You can change any of it later in Settings.</p>
              <div className="card flat">
                <dl className="kv" style={{ gridTemplateColumns: '170px 1fr' }}>
                  <dt>Organization</dt><dd>{org.name} · {template?.title}</dd>
                  <dt>Departments</dt><dd>{departments.filter((d) => d.name.trim()).map((d) => d.name).join(', ')}</dd>
                  <dt>AI assistant</dt><dd>{opts.models.find((m) => m.provider === model.provider)?.title}{model.model ? ` (${model.model})` : ''}</dd>
                  <dt>Channels</dt><dd>{['Web form', email.enabled && 'Email', twilio.enabled && 'Text / WhatsApp'].filter(Boolean).join(', ')}</dd>
                  <dt>Documents</dt><dd>{files.length} to upload{starterDocs && template?.starterDocs.length ? ` + ${template.starterDocs.length} examples` : ''}</dd>
                  <dt>Replies</dt><dd><span className="badge accent">A person approves every reply</span></dd>
                  <dt>Admin</dt><dd>{admin.name} ({admin.email})</dd>
                </dl>
              </div>
            </>
          )}
        </div>

        {error && <div style={{ marginTop: 20 }}><Notice kind="danger">{error}</Notice></div>}

        <div className="wizard-nav">
          {step > (codeOk ? 1 : 0) ? <button className="btn ghost" onClick={() => go(step - 1)}>← Back</button> : <span />}
          {step === 0 && <button className="btn primary lg" disabled={busy || !code.trim()} onClick={checkCode}>{busy ? <Spinner /> : null}Get started</button>}
          {step > 0 && step < 7 && <button className="btn primary lg" onClick={next}>{step === 4 || step === 5 ? 'Continue' : 'Next'}</button>}
          {step === 7 && <button className="btn primary lg" disabled={busy} onClick={finish}>{busy ? <><Spinner /> Setting up…</> : 'Finish setup'}</button>}
        </div>
      </div>
    </div>
  );
}
