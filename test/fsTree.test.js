const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const { runSubDir, writeTreeToDir, readTreeFromDir, writeTreeDelta, buildKeyMap, fileNameFor } = require('../src/utils/fsTree');
const { isValidFilename } = require('../src/core/hash');

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

// --- isValidFilename() ---

test('isValidFilename: accepts plain identifier-shaped names', () => {
  assert.equal(isValidFilename('orders'), true);
  assert.equal(isValidFilename('orders.status'), true);
  assert.equal(isValidFilename('a_b-c.d'), true);
});

test('isValidFilename: rejects path traversal / separators / dotfiles / non-strings', () => {
  assert.equal(isValidFilename('../../etc/passwd'), false);
  assert.equal(isValidFilename('a/b'), false);
  assert.equal(isValidFilename('.'), false);
  assert.equal(isValidFilename('..'), false);
  assert.equal(isValidFilename('.hidden'), false);
  assert.equal(isValidFilename(''), false);
  assert.equal(isValidFilename(undefined), false);
  assert.equal(isValidFilename(123), false);
});

// --- fileNameFor() ---

test('fileNameFor: prefers identity name over hash when identity is a safe filename', () => {
  assert.equal(fileNameFor('collection', 'f6941c6826e8', { collection: 'buyer' }), 'buyer');
  assert.equal(fileNameFor('field', 'ca180662d3ee', { collection: 'orders', field: 'status' }), 'orders.status');
});

test('fileNameFor: falls back to the hash when identity is not a safe filename', () => {
  assert.equal(fileNameFor('collection', 'f6941c6826e8', { collection: '../../etc/passwd' }), 'f6941c6826e8');
});

test('fileNameFor: "meta" kind always uses its name half, ignoring value entirely', () => {
  assert.equal(fileNameFor('meta', 'version', 1), 'version');
});

// --- buildKeyMap() ---

test('buildKeyMap: records the actual filename chosen per key, not just collection/field', () => {
  const tree = {
    'collection:f6941c6826e8': { collection: 'buyer' },
    'collection:aaaaaaaaaaaa': { collection: '../../etc/passwd' },
    'meta:version': 1,
  };
  const map = buildKeyMap(tree);
  assert.deepEqual(map, {
    'collection:f6941c6826e8': { file: 'buyer', collection: 'buyer' },
    'collection:aaaaaaaaaaaa': { file: 'aaaaaaaaaaaa', collection: '../../etc/passwd' },
  });
});

// --- writeTreeDelta() ---
// Uses keys whose hash half deliberately differs from the entity's identity
// (like real entityKey() output) — a key/identity that happen to match
// (e.g. 'collection:orders' + {collection: 'orders'}) can't catch a wrong
// fileNameFor() call, since both would produce the same filename by luck.

test('writeTreeDelta: modified entity overwrites the same identity-named file', () => {
  const dir = makeTmpDir();
  const treeA = { 'collection:f6941c6826e8': { collection: 'buyer', note: 'v1' } };
  writeTreeToDir(treeA, dir);
  const treeB = { 'collection:f6941c6826e8': { collection: 'buyer', note: 'v2' } };
  writeTreeDelta(treeB, treeA, dir);
  assert.deepEqual(readTreeFromDir(dir), treeB);
  assert.equal(fs.existsSync(path.join(dir, 'collection', 'buyer.json')), true);
});

test('writeTreeDelta: removed entity deletes its identity-named file, not a hash-named one', () => {
  const dir = makeTmpDir();
  const treeA = {
    'collection:f6941c6826e8': { collection: 'buyer' },
    'collection:43d86bb730d0': { collection: 'category' },
  };
  writeTreeToDir(treeA, dir);
  assert.equal(fs.existsSync(path.join(dir, 'collection', 'buyer.json')), true);

  const treeB = { 'collection:43d86bb730d0': { collection: 'category' } };
  writeTreeDelta(treeB, treeA, dir);

  assert.equal(fs.existsSync(path.join(dir, 'collection', 'buyer.json')), false);
  assert.equal(fs.existsSync(path.join(dir, 'collection', 'category.json')), true);
  assert.deepEqual(readTreeFromDir(dir), treeB);
});

test('writeTreeDelta: added entity with attacker-controlled identity is written under its hash, not raw content', () => {
  const dir = makeTmpDir();
  const treeA = {};
  writeTreeToDir(treeA, dir);
  const treeB = { 'collection:aaaaaaaaaaaa': { collection: '../../etc/passwd' } };
  writeTreeDelta(treeB, treeA, dir);

  assert.equal(fs.existsSync(path.join(dir, 'collection', 'aaaaaaaaaaaa.json')), true);
  assert.deepEqual(readTreeFromDir(dir), treeB);
});
