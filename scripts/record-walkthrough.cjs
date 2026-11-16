// Records docs/videos walkthrough: start the server with SETUP_CODE=LINCOLN-2026 PORT=3200 on a fresh DATA_DIR, then: node scripts/record-walkthrough.cjs <output-dir>
// Records the full Deskmate journey with captions and a visible cursor.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3200';
const OUT = process.argv[2];
const W = 1440, H = 900;

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

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } } });
  await ctx.addInitScript(INIT);
  const p = await ctx.newPage();
  const wait = (ms) => p.waitForTimeout(ms);
  const say = async (step, text, ms = 2600) => { await p.evaluate(([s, t]) => window.__setCaption(s, t), [step, text]); await wait(ms); };
  const move = async (sel) => { const b = await p.locator(sel).first().boundingBox(); if (b) await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 }); await wait(250); };
  const click = async (sel, pause = 700) => { await move(sel); await p.locator(sel).first().click(); await wait(pause); };
  const type = async (sel, text, delay = 38) => { await click(sel, 200); await p.locator(sel).first().pressSequentially(text, { delay }); await wait(350); };
  const scroll = async (y) => { await p.mouse.wheel(0, y); await wait(700); };

  // ---- Title
  await p.evaluate(() => { try { sessionStorage.removeItem('__cap'); } catch {} }).catch(() => {});
  await p.goto(card('Deskmate', 'An open source AI help desk for schools and organizations.<br>A person approves every reply.', 'A walkthrough of the whole journey · about 3 minutes'));
  await wait(4200);
  await p.evaluate(() => { try { sessionStorage.removeItem('__cap'); } catch {} }).catch(() => {});
  await p.goto(card('Part 1: Setup', 'An office manager sets it up in the browser.<br>No code, no config files.'));
  await wait(3000);

  // ---- Setup wizard
  await p.goto(`${BASE}/setup`);
  await p.waitForSelector('#code');
  await say('Setup', 'After installing, the admin opens Deskmate. A one-time setup code makes sure only they can set it up.');
  await type('#code', 'LINCOLN-2026', 70);
  await click('text=Get started', 900);

  await say('Step 1', 'Name the organization and pick a template. "School" fills in typical departments.', 1500);
  await type('#org', 'Lincoln High School', 45);
  await click('.choice:has-text("University")', 500);
  await click('.choice:has-text("School")', 900);
  await click('button:has-text("Next")', 900);

  await say('Step 2', 'Departments are ready-made and editable. Messages get sorted into these automatically.', 2200);
  await click('button:has-text("Add a department")', 500);
  const last = p.locator('.dept-row').last();
  await move('.dept-row >> nth=-1');
  await last.locator('input').nth(0).pressSequentially('Transport', { delay: 45 });
  await last.locator('input').nth(1).pressSequentially('School buses and routes', { delay: 30 });
  await p.locator('input[aria-label="Words that usually mean this department"]').last().pressSequentially('bus, route, driver, stop', { delay: 30 });
  await wait(1000);
  await click('button:has-text("Next")', 900);

  await say('Step 3', 'Choose the AI. The built-in assistant works offline for free. OpenAI, Anthropic or a private local model are one click away.', 2000);
  await click('.choice:has-text("Anthropic")', 700);
  await say('Step 3', 'Paste a key and press "Test connection". Plain-language feedback, no technical setup.', 1200);
  await type('#key', 'sk-ant-demo-key-for-video', 25);
  await click('button:has-text("Test connection")', 2200);
  await say('Step 3', 'This demo key is not real, so it explains what went wrong. We will use the built-in assistant for now.', 2600);
  await click('.choice:has-text("Built-in assistant")', 1400);
  await click('button:has-text("Next")', 900);

  await say('Step 4', 'Channels: the web help form is always on. Email and text messages / WhatsApp (Twilio) are optional.', 2400);
  await click('text=Send replies by email', 1200);
  await click('text=Send replies by email', 600);
  await click('text=Text messages and WhatsApp', 1400);
  await click('text=Text messages and WhatsApp', 600);
  await click('button:has-text("Continue")', 900);

  await say('Step 5', 'Drag in handbooks and policies. The assistant will only answer from these documents.', 1800);
  const tmp = path.join(OUT, 'Bus routes and term dates.txt');
  fs.writeFileSync(tmp, 'School buses\nBus route 4 now stops at Oak Street instead of Elm Street from Monday. Buses leave school at 15:20. If your child misses the bus, they should go to the front office, and we will phone you.\n\nTerm dates\nThe spring term starts on 6 January and ends on 28 March. Half term is 17 to 21 February.');
  await move('.dropzone');
  await p.setInputFiles('.dropzone input[type=file]', tmp);
  await wait(1600);
  await say('Step 5', 'We also add the example documents so we can try it straight away.', 2000);
  await click('button:has-text("Continue")', 900);

  await say('Step 6', 'Create the administrator account.', 800);
  await type('#an', 'Ana Rivera', 45);
  await type('#ae', 'ana@lincolnhigh.org', 30);
  await type('#ap', 'correct horse battery', 30);
  await click('button:has-text("Next")', 900);

  await say('Step 7', 'A final summary. Every reply waits for a person to approve it.', 3200);
  await click('button:has-text("Finish setup")', 2200);
  await say('Done', 'Ready. Share the help form link on the school website, in newsletters, or on a poster.', 3600);

  // ---- Someone asks for help
  await p.evaluate(() => { try { sessionStorage.removeItem('__cap'); } catch {} }).catch(() => {});
  await p.goto(card('Part 2: Someone asks for help', 'A parent and a student send questions through the help form.'));
  await wait(3000);
  await p.goto(`${BASE}/help`);
  await p.waitForSelector('#m');
  await say('Help form', 'Anyone can ask a question. No account needed.', 1600);
  await type('#n', 'Maria Gomez', 40);
  await type('#em', 'maria.gomez@example.com', 25);
  await type('#s', 'Bus stop changed?', 40);
  await type('#m', 'Hi, my son takes bus route 4. Someone said the stop has changed. Where does it stop now? My number is 415 555 0132 if needed.', 18);
  await click('button:has-text("Send message")', 1500);
  await say('Help form', 'She gets a reference number and a private link to follow her request.', 3000);
  const statusHref = await p.locator('a[href*="/help/status/"]').getAttribute('href');

  // Two more messages, sent quickly in the background
  const quick = async (body) => {
    await p.request.post(`${BASE}/api/public/tickets`, { data: body, headers: { 'content-type': 'application/json' } });
  };
  await quick({ name: 'Jordan', email: 'jordan@example.com', subject: 'Locked out', message: 'I forgot my password and cannot log in to my school account. Exam work is due tomorrow!' });
  await quick({ name: 'A student', message: 'I am being bullied on the bus every day and I feel unsafe. I do not know who to tell.' });
  await say('Help form', 'Meanwhile, two more messages arrive: a locked-out student, and a student reporting bullying.', 3000);

  // ---- Staff review
  await p.evaluate(() => { try { sessionStorage.removeItem('__cap'); } catch {} }).catch(() => {});
  await p.goto(card('Part 3: Staff review', 'The assistant has sorted every message and drafted replies.<br>Nothing is sent until a person approves it.'));
  await wait(3200);
  await p.goto(`${BASE}/app`);
  await p.waitForSelector('text=Waiting for you');
  await say('Home', 'The home page shows what is waiting, in plain language.', 3000);
  await click('.nav-item:has-text("Inbox")', 900);
  await say('Inbox', 'Each message is already sorted by department and urgency. Sensitive ones are flagged in red.', 3400);

  await click('.list-item:has-text("Bus stop changed")', 1200);
  await p.waitForSelector('text=Suggested reply');
  await say('Review', 'The assistant drafted a reply using only the school\'s own document, and shows its source.', 3200);
  await move('.source');
  await say('Privacy', 'Her phone number was hidden from the AI. Staff still see everything.', 3000);
  await move('text=What the assistant did');
  await wait(1200);
  await say('Review', 'Staff can edit the draft before sending. Edits are tracked to measure accuracy.', 1000);
  const ta = p.locator('textarea.reply');
  await move('textarea.reply');
  await ta.click();
  await p.keyboard.press('Control+End');
  await ta.evaluate((el) => { const v = el.value; const i = v.lastIndexOf('Best wishes'); el.setSelectionRange(i, i); });
  await p.keyboard.type('Your son\'s driver will also remind him this week.\n\n', { delay: 28 });
  await wait(700);
  await click('button:has-text("Send reply")', 1600);
  await say('Sent', 'Sent. The reply goes by email (when set up) and to her private status page.', 3000);

  await click('text=← Inbox', 900);
  await click('.list-item:has-text("Locked out")', 1200);
  await p.waitForSelector('text=Suggested reply');
  await say('Review', 'An IT question, marked urgent. The draft looks right, so one click approves it.', 3000);
  await click('button:has-text("Approve and send")', 1800);

  await click('text=← Inbox', 900);
  await click('.list-item:has-text("bullied")', 1200);
  await say('Safety', 'Sensitive messages skip the AI completely. No draft is written. A person must handle it.', 4200);
  await move('.notice.danger');
  await wait(800);
  await type('textarea.reply', 'Thank you for telling us. You did the right thing. Our wellbeing lead, Mr. Shah, will find you today, and you can also go to the front office at any time.', 14);
  await click('button:has-text("Send reply")', 1600);
  await say('Safety', 'Handled by a person, following the school\'s safeguarding procedure.', 2600);

  // ---- Requester sees reply
  await p.evaluate(() => { try { sessionStorage.removeItem('__cap'); } catch {} }).catch(() => {});
  await p.goto(card('Part 4: The answer arrives', 'Maria opens her link and sees the reply.'));
  await wait(2800);
  await p.goto(`${BASE}${statusHref}`);
  await p.waitForSelector('text=Answered');
  await say('Status page', 'Her answer, with the reference number. She can reply here to continue the conversation.', 4200);

  // ---- Knowledge, settings, audit
  await p.evaluate(() => { try { sessionStorage.removeItem('__cap'); } catch {} }).catch(() => {});
  await p.goto(card('Part 5: Running it day to day', 'Documents, safety settings, and a full activity log.'));
  await wait(2800);
  await p.goto(`${BASE}/app/knowledge`);
  await p.waitForSelector('text=Your documents');
  await say('Knowledge', 'Add or remove documents any time. Staff can check what the assistant would find for a question.', 1500);
  await type('input[placeholder^="e.g. How"]', 'when does spring term start', 40);
  await click('button:has-text("Search")', 2600);

  await click('.nav-item:has-text("Settings")', 1000);
  await say('Settings', 'Once a department\'s drafts are reliably right, it can send confident, sourced answers on its own.', 2000);
  await move('label.check >> nth=0');
  await wait(1600);
  await click('.tab:has-text("Privacy")', 900);
  await say('Settings', 'Safety rules are always on. Schools can add their own words that should always go to a person.', 3600);

  await click('.nav-item:has-text("Activity log")', 1000);
  await say('Activity log', 'Every AI decision and every human action is recorded, for accountability and audits.', 3600);
  await click('.nav-item:has-text("Home")', 1000);
  await say('Home', 'The home page now shows questions answered, and how often drafts were approved as written.', 3600);
  await say('', '', 200);

  await p.evaluate(() => { try { sessionStorage.removeItem('__cap'); } catch {} }).catch(() => {});
  await p.goto(card('Deskmate', 'Answers from your documents · A person approves every reply · Private by design', 'Open source · Apache-2.0 · Works with OpenAI, Anthropic, or a private local model'));
  await wait(4500);

  await ctx.close();
  await browser.close();
  fs.unlinkSync(tmp);
})().catch((e) => { console.error(e); process.exit(1); });
