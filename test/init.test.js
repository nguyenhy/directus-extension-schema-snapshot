const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, after } = require('node:test');
const { initRepo, assertReadyForInit, findEnvRoot, renderEnvContent } = require('../src/core/operations/init');
const { DirectoryNotEmptyError } = require('../src/core/errors');
const { DEFAULT_OUT_DIR: outDir, DEFAULT_STORE_DIR: storeDir } = require('../src/core/defaults');

const tmpDirs = [];
after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function freshDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-snapshot-init-'));
  tmpDirs.push(dir);
  return dir;
}

test('initRepo scaffolds .env.schema-snapshot and .gitignore in a standalone dir (no package.json ancestor)', async () => {
  const dir = freshDir();
  assertReadyForInit(dir);

  const view = await initRepo({ dir, outDir, storeDir });

  assert.equal(view.dir, dir);
  assert.equal(view.envPath, path.join(dir, '.env.schema-snapshot'));
  assert.equal(view.envCreated, true);
  assert.equal(view.envReused, false);
  assert.deepEqual(view.filesCreated, [path.join(dir, '.env.schema-snapshot'), path.join(dir, '.gitignore')]);
  assert.ok(fs.existsSync(path.join(dir, '.env.schema-snapshot')));
  assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), '.snapshot/normalized/\n.snapshot/repo/\n');
});

test('initRepo gitignores only the actual configured out-dir/store-dir, appending to an existing .gitignore', async () => {
  const dir = freshDir();
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n');

  await initRepo({ dir, outDir: 'build/out', storeDir: '.cache/store' });

  assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), 'node_modules/\nbuild/out/\n.cache/store/\n');
});

test('initRepo skips gitignoring an out-dir/store-dir that resolves outside dir (e.g. an absolute path elsewhere)', async () => {
  const dir = freshDir();
  const outsideDir = freshDir();

  const view = await initRepo({ dir, outDir: outsideDir, storeDir: '.snapshot/repo' });

  assert.equal(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'), '.snapshot/repo/\n');
  assert.ok(view.filesCreated.includes(path.join(dir, '.gitignore')));
});

test('initRepo does not touch .snapshot/ (OUT_DIR/STORE_DIR) at all', async () => {
  const dir = freshDir();
  await initRepo({ dir, outDir, storeDir });
  assert.ok(!fs.existsSync(path.join(dir, '.snapshot')));
});

test('initRepo puts .env.schema-snapshot at the nearest ancestor package.json root, not the target dir', async () => {
  const root = freshDir();
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  const dir = path.join(root, 'nested', 'target');

  const view = await initRepo({ dir, outDir, storeDir });

  assert.equal(view.envPath, path.join(root, '.env.schema-snapshot'));
  assert.ok(fs.existsSync(path.join(root, '.env.schema-snapshot')));
  assert.ok(!fs.existsSync(path.join(dir, '.env.schema-snapshot')));
  assert.ok(fs.existsSync(path.join(dir, '.gitignore'))); // .gitignore still local to dir
});

test('initRepo never touches a real .env, only .env.schema-snapshot', async () => {
  const root = freshDir();
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  fs.writeFileSync(path.join(root, '.env'), 'REAL=1\n');
  const dir = path.join(root, 'nested', 'target');

  const view = await initRepo({ dir, outDir, storeDir });

  assert.equal(view.envPath, path.join(root, '.env.schema-snapshot'));
  assert.equal(fs.readFileSync(path.join(root, '.env'), 'utf8'), 'REAL=1\n');
  assert.ok(fs.existsSync(path.join(root, '.env.schema-snapshot')));
});

test('initRepo does not overwrite an existing .env.schema-snapshot by default', async () => {
  const root = freshDir();
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  fs.writeFileSync(path.join(root, '.env.schema-snapshot'), 'EXISTING=1\n');
  const dir = path.join(root, 'nested', 'target');

  const view = await initRepo({ dir, outDir, storeDir });

  assert.equal(view.envCreated, false);
  assert.equal(view.envReused, true);
  assert.equal(fs.readFileSync(path.join(root, '.env.schema-snapshot'), 'utf8'), 'EXISTING=1\n');
  assert.deepEqual(view.filesCreated, [path.join(dir, '.gitignore')]);
});

test('initRepo overwrites an existing .env.schema-snapshot when overwriteEnv is true', async () => {
  const root = freshDir();
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  fs.writeFileSync(path.join(root, '.env.schema-snapshot'), 'EXISTING=1\n');
  const dir = path.join(root, 'nested', 'target');

  const view = await initRepo({ dir, outDir, storeDir, overwriteEnv: true });

  assert.equal(view.envCreated, true);
  assert.equal(view.envReused, false);
  assert.notEqual(fs.readFileSync(path.join(root, '.env.schema-snapshot'), 'utf8'), 'EXISTING=1\n');
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

test('renderEnvContent overrides only the given vars, leaves the rest and comments untouched', () => {
  const template = ['# comment', 'SCHEMA_SNAPSHOT_OUT_DIR=.snapshot/normalized', 'SCHEMA_SNAPSHOT_TYPE=directus', ''].join('\n');
  const rendered = renderEnvContent(template, { SCHEMA_SNAPSHOT_TYPE: 'custom' });

  assert.match(rendered, /^# comment$/m);
  assert.match(rendered, /^SCHEMA_SNAPSHOT_OUT_DIR=\.snapshot\/normalized$/m);
  assert.match(rendered, /^SCHEMA_SNAPSHOT_TYPE=custom$/m);
});

test('renderEnvContent ignores unrecognized override keys', () => {
  const template = 'SCHEMA_SNAPSHOT_TYPE=directus\n';
  const rendered = renderEnvContent(template, { NOT_A_REAL_VAR: 'x' });
  assert.equal(rendered, template);
});

test('initRepo writes envOverrides into a freshly scaffolded env file', async () => {
  const dir = freshDir();
  assertReadyForInit(dir);

  await initRepo({ dir, outDir, storeDir, envOverrides: { SCHEMA_SNAPSHOT_TYPE: 'custom-type' } });

  const content = fs.readFileSync(path.join(dir, '.env.schema-snapshot'), 'utf8');
  assert.match(content, /^SCHEMA_SNAPSHOT_TYPE=custom-type$/m);
});

test('assertReadyForInit ignores OS junk files and unrelated content outside schema-snapshots/', () => {
  const dir = freshDir();
  fs.writeFileSync(path.join(dir, '.DS_Store'), '');
  fs.writeFileSync(path.join(dir, '.env'), '');
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'hi'); // no longer checked at all
  assert.doesNotThrow(() => assertReadyForInit(dir));
});

test('assertReadyForInit does not reject a dir that already has .snapshot/ (OUT_DIR/STORE_DIR) content', () => {
  const dir = freshDir();
  fs.mkdirSync(path.join(dir, '.snapshot', 'repo', '.git'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.snapshot', 'normalized'), { recursive: true });
  assert.doesNotThrow(() => assertReadyForInit(dir));
});

test('assertReadyForInit does not reject a schema-snapshots/ dir with only a valid event log (idempotent init-after-init)', () => {
  const dir = freshDir();
  const snapshotsDir = path.join(dir, 'schema-snapshots');
  fs.mkdirSync(path.join(snapshotsDir, 'source'), { recursive: true });
  fs.writeFileSync(path.join(snapshotsDir, 'meta.json'), JSON.stringify({ events: [] }));
  assert.doesNotThrow(() => assertReadyForInit(dir));
});

test('assertReadyForInit rejects a schema-snapshots/ dir with unrecognized (non-event-log) content', () => {
  const dir = freshDir();
  fs.mkdirSync(path.join(dir, 'schema-snapshots'));
  fs.writeFileSync(path.join(dir, 'schema-snapshots', 'random.txt'), 'hi');
  assert.throws(() => assertReadyForInit(dir), DirectoryNotEmptyError);
});

test('assertReadyForInit respects a custom snapshotsDirName', () => {
  const dir = freshDir();
  fs.mkdirSync(path.join(dir, 'custom-snapshots'));
  fs.writeFileSync(path.join(dir, 'custom-snapshots', 'random.txt'), 'hi');
  assert.doesNotThrow(() => assertReadyForInit(dir, 'schema-snapshots')); // default name untouched
  assert.throws(() => assertReadyForInit(dir, 'custom-snapshots'), DirectoryNotEmptyError);
});
