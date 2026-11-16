import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bm25Index, chunkText, getTemplate, MockModel, redact, restore, runPipeline, screenSafety } from '../src/index.ts';
import type { KnowledgeDoc, OrgProfile } from '../src/index.ts';

const school = getTemplate('school');
const org: OrgProfile = { name: 'Lincoln High', template: 'school', departments: school.departments, signature: 'The Lincoln High team' };
const docs: KnowledgeDoc[] = school.starterDocs.map((d, i) => ({
  id: `d${i}`, title: d.title, filename: 'x.txt', createdAt: '', chars: d.text.length, chunks: chunkText(`d${i}`, d.text),
}));

test('redact hides personal details and restores them', () => {
  const input = 'Email me at jo.smith@example.org or call +1 415 555 0132. Card 4242 4242 4242 4242, student id: S123456';
  const { text, redactions } = redact(input);
  assert.ok(!text.includes('jo.smith@example.org'));
  assert.ok(!text.includes('4242 4242'));
  assert.ok(!text.includes('555 0132'));
  assert.ok(text.includes('[EMAIL_1]'));
  assert.equal(restore(text, redactions), input);
});

test('safety screen flags sensitive messages and ignores ordinary ones', () => {
  assert.equal(screenSafety('I want to kill myself').category, 'self_harm');
  assert.equal(screenSafety('My son is being bullied on the bus').category, 'safeguarding');
  assert.equal(screenSafety('Can you troubleshoot my printer?').flagged, false);
});

test('search finds the right document', () => {
  const idx = new Bm25Index(docs);
  const hits = idx.search('how do I reset my password');
  assert.equal(hits[0]?.docTitle, 'Sample: IT help guide');
});

test('pipeline triages, drafts with citations, and never leaks PII to the model', async () => {
  const seen: string[] = [];
  const model = new MockModel();
  const spy = { ...model, provider: model.provider, label: model.label, test: model.test,
    complete: async (r: Parameters<MockModel['complete']>[0]) => { seen.push(r.prompt); return model.complete(r); } };
  const res = await runPipeline({
    text: 'Hi, I forgot my password and cannot get into my account. My email is pat@example.com',
    org, knowledge: new Bm25Index(docs), model: spy,
  });
  assert.equal(res.triage.departmentId, 'it');
  assert.ok(res.draft?.grounded);
  assert.ok(res.draft!.citations.length > 0);
  assert.ok(seen.every((p) => !p.includes('pat@example.com')));
});

test('pipeline sends sensitive messages to a person with no AI draft', async () => {
  const res = await runPipeline({ text: 'My daughter says she is being bullied and feels unsafe at home', org, knowledge: new Bm25Index(docs), model: new MockModel() });
  assert.equal(res.draft, null);
  assert.equal(res.triage.urgency, 'urgent');
});

test('pipeline admits when it does not know', async () => {
  const res = await runPipeline({ text: 'What colour is the new school minibus?', org, knowledge: new Bm25Index(docs), model: new MockModel() });
  assert.equal(res.draft?.grounded, false);
  assert.match(res.draft!.body, /member of our team/);
});
