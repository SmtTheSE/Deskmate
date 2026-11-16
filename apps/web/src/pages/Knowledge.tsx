import { useEffect, useState } from 'react';
import { api, fileToBase64 } from '../api';
import { Dropzone, Notice, Spinner, timeAgo, useToast } from '../components/ui';

export default function Knowledge() {
  const [docs, setDocs] = useState<any[] | null>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [paste, setPaste] = useState({ open: false, title: '', text: '' });
  const toast = useToast();

  const load = () => api('/api/knowledge').then(setDocs);
  useEffect(() => { load(); }, []);

  const upload = async (files: File[]) => {
    setErrors([]);
    for (const f of files) {
      setUploading((u) => [...u, f.name]);
      try {
        await api('/api/knowledge', { body: { filename: f.name, base64: await fileToBase64(f) } });
      } catch (e: any) { setErrors((x) => [...x, `${f.name}: ${e.message}`]); }
      setUploading((u) => u.filter((n) => n !== f.name));
    }
    load();
    toast.show('Documents added');
  };

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div>
          <h1>Knowledge</h1>
          <p>The assistant only answers from these documents. Add the things people ask about most.</p>
        </div>
        <button className="btn" onClick={() => setPaste({ ...paste, open: !paste.open })}>Paste text instead</button>
      </div>
      <div className="stack-lg">
        <div className="stack">
          {paste.open && (
            <div className="card flat stack">
              <input className="input" placeholder="Title, e.g. Term dates 2026" value={paste.title} onChange={(e) => setPaste({ ...paste, title: e.target.value })} />
              <textarea className="textarea" rows={8} placeholder="Paste the text here" value={paste.text} onChange={(e) => setPaste({ ...paste, text: e.target.value })} />
              <div><button className="btn primary" disabled={!paste.title.trim() || paste.text.trim().length < 20} onClick={async () => {
                try { await api('/api/knowledge', { body: { title: paste.title, filename: `${paste.title}.txt`, text: paste.text } }); setPaste({ open: false, title: '', text: '' }); load(); toast.show('Added'); } catch (e: any) { setErrors([e.message]); }
              }}>Add to knowledge</button></div>
            </div>
          )}
          <Dropzone compact onFiles={upload} />
          {uploading.map((n) => <div key={n} className="row small muted"><Spinner /> Reading {n}…</div>)}
          {errors.map((e) => <Notice key={e} kind="danger">{e}</Notice>)}
        </div>

        <div className="stack-sm">
          <h3>Your documents</h3>
          {!docs ? <Spinner /> : docs.length ? (
            <div className="list">
              {docs.map((d) => (
                <div key={d.id} className="list-item" style={{ alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="subject">{d.title}</div>
                    <div className="summary">{d.filename} · {d.sections} section{d.sections === 1 ? '' : 's'} · added {timeAgo(d.createdAt)}</div>
                  </div>
                  <button className="btn ghost sm danger" onClick={async () => { await api(`/api/knowledge/${d.id}`, { method: 'DELETE' }); load(); }}>Remove</button>
                </div>
              ))}
            </div>
          ) : <div className="card flat empty"><h3>No documents yet</h3><p className="small">Without documents, the assistant will say a person will follow up.</p></div>}
        </div>

        <div className="stack-sm">
          <h3>Check what the assistant would find</h3>
          <p className="small muted">Type a question the way someone would ask it.</p>
          <form className="row" onSubmit={async (e) => { e.preventDefault(); setResults(await api('/api/knowledge/search', { body: { q } })); }}>
            <input className="input" placeholder="e.g. How do I reset my password?" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn dark" disabled={!q.trim()}>Search</button>
          </form>
          {results && (results.length ? (
            <div className="sources">{results.map((r, i) => <div key={i} className="source"><div className="t">{r.title} <span className="faint" style={{ fontWeight: 400 }}>· match {r.score}</span></div><div className="muted">{r.text.slice(0, 320)}{r.text.length > 320 ? '…' : ''}</div></div>)}</div>
          ) : <Notice kind="warn">Nothing matched. Questions like this would go to a person.</Notice>)}
        </div>
      </div>
      {toast.node}
    </div>
  );
}
