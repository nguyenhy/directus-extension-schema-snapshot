const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const { runSubDir, writeTreeToDir, readTreeFromDir } = require('../src/utils/fsTree');

const tmpDirs = [];
after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-snapshot-fstree-'));
  tmpDirs.push(dir);
  return dir;
}

test('runSubDir: renders {name} and {time} placeholders', () => {
  const result = runSubDir('/out', '/in/schema.json', '{name}_{time}');
  assert.match(result, /^\/out\/schema_\d{8}-\d{6}$/);
});

test('runSubDir: throws when format has no placeholders', () => {
  assert.throws(() => runSubDir('/out', '/in/schema.json', 'static'), /must use at least one of/);
});

test('runSubDir: throws on unknown placeholder', () => {
  assert.throws(() => runSubDir('/out', '/in/schema.json', '{bogus}'), /unknown placeholder \{bogus\}/);
});

test('runSubDir: throws when rendered path would escape outDir via ".."', () => {
  assert.throws(() => runSubDir('/out', '/in/..json', '{name}'), /not a safe path/);
});

test('writeTreeToDir + readTreeFromDir: round-trips an EntityTree unchanged', () => {
  const dir = makeTmpDir();
  const tree = {
    'collection:orders': { collection: 'orders', meta: { note: 'x' } },
    'field:orders.status': { collection: 'orders', field: 'status' },
  };
  writeTreeToDir(tree, dir);
  const readBack = readTreeFromDir(dir);
  assert.deepEqual(readBack, tree);
});

test('readTreeFromDir: returns {} for a directory that does not exist yet', () => {
  const dir = path.join(os.tmpdir(), 'schema-snapshot-fstree-missing-' + Date.now());
  assert.deepEqual(readTreeFromDir(dir), {});
});
