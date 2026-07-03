const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, after } = require('node:test');
const { GitStore } = require('../src/core/store/git');
const { getRawSourceView } = require('../src/core/operations/get');

const tmpDirs = [];
after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function makeStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-snapshot-get-'));
  tmpDirs.push(dir);
  return new GitStore(dir);
}

test('getRawSourceView returns the raw source exactly as committed, no reconstruction', async () => {
  const store = makeStore();
  const raw = { collections: [{ collection: 'orders' }], note: 'original source' };
  const { id } = await store.set({ 'collection:orders': { collection: 'orders' } }, 'first', raw);

  const view = await getRawSourceView({ id, store });

  assert.equal(view.id, id);
  assert.deepEqual(view.raw, raw);
});

test('getRawSourceView throws a clean error when no raw source was stored for that version', async () => {
  const store = makeStore();
  const { id } = await store.set({ 'collection:orders': { collection: 'orders' } }, 'first');

  await assert.rejects(() => getRawSourceView({ id, store }), /No raw source stored/);
});
