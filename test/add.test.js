const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, after } = require('node:test');
const { GitStore } = require('../src/core/store/git');
const { addVersion } = require('../src/core/operations/add');
const { getRawSourceView } = require('../src/core/operations/get');

const tmpDirs = [];
after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function makeStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-snapshot-add-'));
  tmpDirs.push(dir);
  return new GitStore(dir);
}

test('addVersion stores the raw pre-normalize source so it is retrievable via get, unmodified', async () => {
  const store = makeStore();
  const inputPath = path.join(os.tmpdir(), 'schema-snapshot-add-input.json');
  const raw = { collections: [{ collection: 'orders', meta: { note: 'x' } }], fields: [], relations: [] };
  fs.writeFileSync(inputPath, JSON.stringify(raw));

  const view = await addVersion({
    inputPath,
    schemaType: 'directus',
    message: 'first',
    store,
    parse: (p) => JSON.parse(fs.readFileSync(p, 'utf8')),
  });

  const gotten = await getRawSourceView({ id: view.id, store });
  assert.deepEqual(gotten.raw, raw);

  fs.rmSync(inputPath);
});
