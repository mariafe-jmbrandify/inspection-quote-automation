/**
 * Checks the built workflow JSON without needing n8n running:
 * every Code node compiles, every connection points at a real node,
 * the generated code matches /src (no stale build), and no secrets leaked in.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dir = path.join(__dirname, '..', 'workflows');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
const load = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));

test('workflow files exist', () => {
  assert.deepEqual(files.sort(), ['inspection-quote-error-alerts.json', 'inspection-quote-main.json', 'mock-inbox.json']);
});

test('build output is up to date with src/', () => {
  const before = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));
  execFileSync(process.execPath, [path.join(__dirname, '..', 'build', 'build-workflows.js')], { stdio: 'ignore' });
  const after = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));
  assert.deepEqual(after, before, 'Run `npm run build` and commit the result');
});

for (const f of files) {
  const wf = load(f);

  test(`${f}: connections reference existing nodes`, () => {
    const names = new Set(wf.nodes.map((n) => n.name));
    for (const [from, c] of Object.entries(wf.connections)) {
      assert.ok(names.has(from), from);
      c.main.flat().forEach((t) => assert.ok(names.has(t.node), `${from} -> ${t.node}`));
    }
  });

  test(`${f}: every Code node compiles`, () => {
    for (const n of wf.nodes.filter((x) => x.type === 'n8n-nodes-base.code')) {
      assert.doesNotThrow(() => new Function(`return (async () => {\n${n.parameters.jsCode}\n})`), `${n.name} does not compile`);
      assert.ok(!n.parameters.jsCode.includes('module.exports'), `${n.name} still has module.exports`);
    }
  });

  test(`${f}: no secrets in the export`, () => {
    const raw = JSON.stringify(wf);
    assert.ok(!/sk-ant-[A-Za-z0-9]/.test(raw), 'Anthropic key found');
    assert.ok(!/api_token=[A-Za-z0-9]{10,}/.test(raw), 'Pipedrive token found');
  });
}

test('main workflow: every path ends in a response or notification', () => {
  const wf = load('inspection-quote-main.json');
  const out = (name) => (wf.connections[name] ? wf.connections[name].main.flat() : []);
  const terminals = wf.nodes
    .filter((n) => n.type !== 'n8n-nodes-base.stickyNote' && out(n.name).length === 0)
    .map((n) => n.name)
    .sort();
  assert.deepEqual(terminals, ['Notify: Outcome', 'Respond 200 Duplicate', 'Respond 400 Invalid']);
  // Every IF node has both branches wired.
  wf.nodes.filter((n) => n.type === 'n8n-nodes-base.if').forEach((n) => {
    assert.equal(wf.connections[n.name].main.length, 2, n.name);
    wf.connections[n.name].main.forEach((b) => assert.ok(b.length > 0, `${n.name} has an unwired branch`));
  });
  assert.equal(wf.settings.errorWorkflow, load('inspection-quote-error-alerts.json').id);
});
