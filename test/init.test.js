const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, after } = require('node:test');
const { GitStore } = require('../src/core/store/git');
const { initRepo, assertReadyForInit, findEnvRoot } = require('../src/core/operations/init');
const { DirectoryNotEmptyError } = require('../src/core/errors');

const tmpDirs = [];
after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function freshDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-snapshot-init-'));
  tmpDirs.push(dir);
  return dir;
}

test('initRepo scaffolds .env.schema-snapshot, .gitignore, and a working GitStore in a standalone dir (no package.json ancestor)', async () => {
  const dir = freshDir();
  assertReadyForInit(dir);
  const store = new GitStore(path.join(dir, '.snapshot', 'repo'));

  const view = await initRepo({ dir, store });

  assert.equal(view.dir, dir);
  assert.equal(view.envPath, path.join(dir, '.env.schema-snapshot'));
  assert.equal(view.envCreated, true);
  assert.deepEqual(view.filesCreated, [path.join(dir, '.env.schema-snapshot'), path.join(dir, '.gitignore')]);
  assert.ok(fs.existsSync(path.join(dir, '.env.schema-snapshot')));
  assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), '.snapshot/\n');
  assert.ok(fs.existsSync(path.join(dir, '.snapshot', 'repo', '.git')));
});

test('initRepo puts .env.schema-snapshot at the nearest ancestor package.json root, not the target dir', async () => {
  const root = freshDir();
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  const dir = path.join(root, 'nested', 'target');
  const store = new GitStore(path.join(dir, '.snapshot', 'repo'));

  const view = await initRepo({ dir, store });

  assert.equal(view.envPath, path.join(root, '.env.schema-snapshot'));
  assert.ok(fs.existsSync(path.join(root, '.env.schema-snapshot')));
  assert.ok(!fs.existsSync(path.join(dir, '.env.schema-snapshot')));
  assert.ok(fs.existsSync(path.join(dir, '.gitignore'))); // .gitignore/store still local to dir
});

test('initRepo never touches a real .env, only .env.schema-snapshot', async () => {
  const root = freshDir();
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  fs.writeFileSync(path.join(root, '.env'), 'REAL=1\n');
  const dir = path.join(root, 'nested', 'target');
  const store = new GitStore(path.join(dir, '.snapshot', 'repo'));

  const view = await initRepo({ dir, store });

  assert.equal(view.envPath, path.join(root, '.env.schema-snapshot'));
  assert.equal(fs.readFileSync(path.join(root, '.env'), 'utf8'), 'REAL=1\n');
  assert.ok(fs.existsSync(path.join(root, '.env.schema-snapshot')));
});

test('initRepo does not overwrite an existing .env.schema-snapshot at the resolved env root', async () => {
  const root = freshDir();
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  fs.writeFileSync(path.join(root, '.env.schema-snapshot'), 'EXISTING=1\n');
  const dir = path.join(root, 'nested', 'target');
  const store = new GitStore(path.join(dir, '.snapshot', 'repo'));

  const view = await initRepo({ dir, store });

  assert.equal(view.envCreated, false);
  assert.equal(fs.readFileSync(path.join(root, '.env.schema-snapshot'), 'utf8'), 'EXISTING=1\n');
  assert.deepEqual(view.filesCreated, [path.join(dir, '.gitignore')]);
});

test('findEnvRoot walks up to the nearest package.json, falls back to dir itself if none found', () => {
  const root = freshDir();
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  const nested = path.join(root, 'a', 'b');
  fs.mkdirSync(nested, { recursive: true });

  assert.equal(findEnvRoot(nested), root);

  const standalone = freshDir();
  assert.equal(findEnvRoot(standalone), path.resolve(standalone));
});

test('assertReadyForInit ignores OS junk files, and a pre-existing .env, when checking emptiness', () => {
  const dir = freshDir();
  fs.writeFileSync(path.join(dir, '.DS_Store'), '');
  fs.writeFileSync(path.join(dir, '.env'), '');
  assert.doesNotThrow(() => assertReadyForInit(dir));
});

test('assertReadyForInit rejects a dir with real content', () => {
  const dir = freshDir();
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'hi');
  assert.throws(() => assertReadyForInit(dir), DirectoryNotEmptyError);
});

test('assertReadyForInit rejects a dir that already has schema-snapshots/', () => {
  const dir = freshDir();
  fs.mkdirSync(path.join(dir, 'schema-snapshots'));
  assert.throws(() => assertReadyForInit(dir), require('../src/core/errors').AlreadyInitializedError);
});
