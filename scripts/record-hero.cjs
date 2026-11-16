// Records the full Deskmate journey with captions and a visible cursor.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3200';
const OUT = process.argv[2];
const W = 1280, H = 800;

const INIT = `
(() => {
  const ready = () => {
    if (document.getElementById('__cursor')) return;
    const c = document.createElement('div');
    c.id = '__cursor';
    c.style.cssText = 'position:fixed;left:-50px;top:-50px;width:22px;height:22px;border-radius:50%;background:rgba(194,96,62,.35);border:2px solid #c2603e;z-index:2147483647;pointer-events:none;transform:translate(-50%,-50%);transition:left .35s ease,top .35s ease,width .15s,height .15s';
    document.body.appendChild(c);
    let saved = null, cap = null; try { saved = sessionStorage.getItem('__cur'); cap = sessionStorage.getItem('__cap'); } catch {}
    if (saved) { const [x,y] = saved.split(','); c.style.left = x + 'px'; c.style.top = y + 'px'; }
    addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; try { sessionStorage.setItem('__cur', e.clientX + ',' + e.clientY); } catch {} }, true);
    addEventListener('mousedown', () => { c.style.width = '16px'; c.style.height = '16px'; }, true);
    addEventListener('mouseup', () => { c.style.width = '22px'; c.style.height = '22px'; }, true);
    if (cap) window.__setCaption(...JSON.parse(cap));
  };
  window.__setCaption = (step, text) => {
    try { sessionStorage.setItem('__cap', JSON.stringify([step, text])); } catch {}
    let el = document.getElementById('__caption');
    if (!el) {
      el = document.createElement('div');
      el.id = '__caption';
      el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);max-width:880px;width:calc(100% - 80px);background:rgba(31,30,28,.92);color:#faf9f5;padding:14px 22px;border-radius:16px;font:500 17px/1.45 Inter Variable,system-ui,sans-serif;z-index:2147483646;box-shadow:0 8px 30px rgba(0,0,0,.25);display:flex;gap:14px;align-items:center;pointer-events:none';
      document.body.appendChild(el);
    }
    el.innerHTML = (step ? '<span style="flex-shrink:0;background:#c2603e;color:#fff;border-radius:999px;padding:3px 11px;font-size:13px;font-weight:600">' + step + '</span>' : '') + '<span>' + text + '</span>';
    el.style.display = text ? 'flex' : 'none';
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();`;

function card(title, sub, foot) {
  return `data:text/html,${encodeURIComponent(`<!doctype html><html><head><style>
  @import url('${BASE}/');
  body{margin:0;height:100vh;display:grid;place-items:center;background:#faf9f5;font-family:Inter Variable,system-ui,sans-serif;color:#1f1e1c}
  .w{text-align:center;max-width:900px;padding:40px}
  .logo{width:72px;height:72px;border-radius:20px;background:#c2603e;display:inline-grid;place-items:center;margin-bottom:28px}
  h1{font-family:'Source Serif 4',Georgia,serif;font-weight:500;font-size:56px;margin:0 0 16px;letter-spacing:-.01em}
  p{font-size:22px;color:#5f5d57;margin:0;line-height:1.5}
  .f{margin-top:36px;font-size:15px;color:#8b8982}
  </style></head><body><div class="w"><div class="logo"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"><path d="M4 7.5A3.5 3.5 0 0 1 7.5 4h9A3.5 3.5 0 0 1 20 7.5v5a3.5 3.5 0 0 1-3.5 3.5H11l-4.5 4v-4.2A3.5 3.5 0 0 1 4 12.5z"/></svg></div>
  <h1>${title}</h1><p>${sub}</p>${foot ? `<div class="f">${foot}</div>` : ''}</div></body></html>`)}`;
}

const B = 'http://localhost:3201';
(async () => {
  // Prepare a configured help desk on B (not recorded).
  const req = await require('playwright').request.newContext({ baseURL: B, extraHTTPHeaders: { 'content-type': 'application/json' } });
  await req.post('/api/setup/complete', { data: { setupCode: 'LINCOLN-2026', org: { name: 'Lincoln High School', template: 'school' }, admin: { name: 'Ana Rivera', email: 'ana@lincolnhigh.org', password: 'correct horse battery' }, model: { provider: 'mock' }, starterDocs: true } });
  await req.post('/api/knowledge', { data: { title: 'Bus routes and term dates', filename: 'bus.txt', text: 'School buses\nBus route 4 now stops at Oak Street instead of Elm Street from Monday. Buses leave school at 15:20. If your child misses the bus, they should go to the front office, and we will phone you.' } });
  await req.post('/api/public/tickets', { data: { name: 'Jordan', email: 'jordan@example.com', subject: 'Locked out', message: 'I forgot my password and cannot log in to my school account.' } });
  await req.post('/api/public/tickets', { data: { name: 'A student', message: 'I am being bullied on the bus every day and I feel unsafe.' } });
  const storage = await req.storageState();

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } }, storageState: storage });
  await ctx.addInitScript(INIT);
  const p = await ctx.newPage();
  const wait = (ms) => p.waitForTimeout(ms);
  const say = async (step, text, ms = 1800) => { await p.evaluate(([s, t]) => window.__setCaption(s, t), [step, text]); await wait(ms); };
  const move = async (sel) => { const b = await p.locator(sel).first().boundingBox(); if (b) await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 }); await wait(150); };
  const click = async (sel, pause = 500) => { await move(sel); await p.locator(sel).first().click(); await wait(pause); };
  const type = async (sel, text, delay = 22) => { await click(sel, 100); await p.locator(sel).first().pressSequentially(text, { delay }); await wait(200); };

  // 1. Setup wizard glimpse (fresh install on A)
  await p.goto(`${BASE}/setup?code=LINCOLN-2026`);
  await p.waitForSelector('text=Get started');
  await say('1', 'Set up in your browser. No code, no config files.', 1400);
  await click('text=Get started', 500);
  await type('#org', 'Lincoln High School', 30);
  await click('.choice:has-text("School")', 600);
  await click('button:has-text("Next")', 1200);
  await click('button:has-text("Next")', 500);
  await say('1', 'Built-in offline assistant, OpenAI, Anthropic, or a private local model.', 1200);
  await click('.choice:has-text("Private model")', 1100);
  await click('.choice:has-text("Built-in")', 600);

  // 2. Someone asks
  await p.evaluate(() => { try { sessionStorage.removeItem('__cap'); } catch {} });
  await p.goto(`${B}/help`);
  await p.waitForSelector('#m');
  await say('2', 'Parents, students and staff ask on the web form, by email, SMS or WhatsApp.', 600);
  await type('#n', 'Maria Gomez', 25);
  await type('#m', 'Hi, my son takes bus route 4. Has the stop changed? You can call me on 415 555 0132.', 14);
  await click('button:has-text("Send message")', 1000);

  // 3. Inbox
  await p.goto(`${B}/app/inbox`);
  await p.waitForSelector('.list-item:has-text("bus route 4")');
  await say('3', 'Every message is sorted by department and urgency. Sensitive ones are flagged.', 2200);
  await click('.list-item:has-text("bus route 4")', 900);
  await p.waitForSelector('text=Suggested reply');
  await say('4', 'The AI drafts a reply only from your documents, and shows its sources.', 1600);
  await move('.source');
  await say('4', 'Phone numbers, emails and IDs are hidden from the AI.', 1600);
  await move('text=What the assistant did');
  await wait(600);
  await say('5', 'A person approves every reply. One click.', 700);
  await click('button:has-text("Approve and send")', 1500);

  await click('text=← Inbox', 600);
  await click('.list-item:has-text("bullied")', 900);
  await say('6', 'Safeguarding concerns skip the AI entirely and go straight to a person.', 2600);

  await p.goto(`${B}/app`);
  await p.waitForSelector('text=Waiting for you');
  await say('7', 'Open source. Self-host with one command, run it on a laptop, or deploy in a click.', 2600);
  await say('', '', 100);

  await ctx.close();
  await browser.close();
  await req.dispose();
})().catch((e) => { console.error(e); process.exit(1); });
