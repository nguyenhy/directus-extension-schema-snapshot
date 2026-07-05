const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { extractSchemas, buildExtractMeta, verifyMerge } = require('../src/core/operations/extract');
const { diff } = require('../src/core/diff');
const { cmdExtract } = require('../src/cli/commands/extract');
const { parseJSONFile } = require('../src/utils/parseJson');

const tmpDirs = [];
after(() => {
  for (const dir of tmpDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
});

function getTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-snapshot-extract-test-'));
  tmpDirs.push(dir);
  return dir;
}

test('buildExtractMeta: builds correct metadata summary', () => {
  const tree = {
    'collection:orders': { collection: 'orders' },
    'field:orders.status': { collection: 'orders', field: 'status' },
    'relation:orders.customer': { collection: 'orders', field: 'customer' },
  };

  const meta = buildExtractMeta(tree, 'old-schema.json', 'new-schema.json', 'added');

  assert.equal(meta.old, 'old-schema.json');
  assert.equal(meta.new, 'new-schema.json');
  assert.equal(meta.mode, 'added');
  assert.ok(meta.timestamp);
  assert.ok(meta.toolVersion);
  assert.deepEqual(meta.counts, { collections: 1, fields: 1, systemfields: 0, relations: 1 });
  assert.deepEqual(meta.collections, {
    orders: {
      fields: ['status'],
      systemfields: [],
      relations: ['customer'],
    },
  });
});

test('extractSchemas: dryRun with snapshot=true returns the snapshot and metadata', async () => {
  const oldSchema = path.join(__dirname, '../fixtures/v1.json');
  const newSchema = path.join(__dirname, '../fixtures/v2.json');

  const result = await extractSchemas({
    oldSchema,
    newSchema,
    mode: 'added',
    schemaType: 'directus',
    outDir: 'dummy',
    subdirFormat: '{name}_{time}',
    dryRun: true,
    store: null,
    parse: parseJSONFile,
    snapshot: true,
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.isSnapshot, true);
  assert.equal(result.keys.length, 1);
  assert.match(result.keys[0], /^field:/);
  // snapshot is the full reconstructed schema: old entities + the added one
  assert.deepEqual(result.snapshot.data.collections, [{ collection: 'orders', meta: { note: 'orders table' } }]);
  assert.deepEqual(result.snapshot.data.fields, [
    { collection: 'orders', field: 'legacy_flag', type: 'boolean' },
    { collection: 'orders', field: 'status', type: 'string' },
    { collection: 'orders', field: 'tracking_number', type: 'string' },
  ]);
  assert.equal(result.meta.old, oldSchema);
  assert.equal(result.meta.new, newSchema);
  assert.equal(result.meta.mode, 'added');
  assert.equal(result.verification.ok, true);
});

test('extractSchemas: dryRun with snapshotFile returns the snapshot and metadata', async () => {
  const oldSchema = path.join(__dirname, '../fixtures/v1.json');
  const newSchema = path.join(__dirname, '../fixtures/v2.json');

  const result = await extractSchemas({
    oldSchema,
    newSchema,
    mode: 'added',
    schemaType: 'directus',
    outDir: 'dummy',
    subdirFormat: '{name}_{time}',
    dryRun: true,
    store: null,
    parse: parseJSONFile,
    snapshotFile: 'dummy-snapshot.json',
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.isSnapshot, true);
  assert.deepEqual(result.snapshot.data.fields, [
    { collection: 'orders', field: 'legacy_flag', type: 'boolean' },
    { collection: 'orders', field: 'status', type: 'string' },
    { collection: 'orders', field: 'tracking_number', type: 'string' },
  ]);
  assert.equal(result.verification.ok, true);
});

test('extractSchemas: no-dry-run with snapshot=true writes snapshot.json and meta.json to outDir', async () => {
  const oldSchema = path.join(__dirname, '../fixtures/v1.json');
  const newSchema = path.join(__dirname, '../fixtures/v2.json');
  const outDir = getTmpDir();

  const result = await extractSchemas({
    oldSchema,
    newSchema,
    mode: 'added',
    schemaType: 'directus',
    outDir,
    subdirFormat: '{name}_run-subdir',
    dryRun: false,
    store: null,
    parse: parseJSONFile,
    snapshot: true,
  });

  assert.equal(result.dryRun, false);
  assert.equal(result.isSnapshot, true);
  const targetSubdir = path.join(outDir, 'v2_run-subdir');
  assert.equal(result.view.dir, targetSubdir);
  assert.equal(result.file, path.join(targetSubdir, 'snapshot.json'));

  // Verify files exist and have correct contents
  assert.ok(fs.existsSync(path.join(targetSubdir, 'snapshot.json')));
  assert.ok(fs.existsSync(path.join(targetSubdir, 'meta.json')));

  const snapshotContent = JSON.parse(fs.readFileSync(path.join(targetSubdir, 'snapshot.json'), 'utf8'));
  assert.deepEqual(snapshotContent.data.fields, [
    { collection: 'orders', field: 'legacy_flag', type: 'boolean' },
    { collection: 'orders', field: 'status', type: 'string' },
    { collection: 'orders', field: 'tracking_number', type: 'string' },
  ]);

  const metaContent = JSON.parse(fs.readFileSync(path.join(targetSubdir, 'meta.json'), 'utf8'));
  assert.equal(metaContent.old, oldSchema);
  assert.equal(metaContent.new, newSchema);
  assert.equal(result.verification.ok, true);
});

test('extractSchemas: no-dry-run with snapshotFile writes exact file and companion meta.json', async () => {
  const oldSchema = path.join(__dirname, '../fixtures/v1.json');
  const newSchema = path.join(__dirname, '../fixtures/v2.json');
  const outDir = getTmpDir();
  const snapshotFile = path.join(outDir, 'my-schema.json');
  const metaFile = path.join(outDir, 'my-schema.meta.json');

  const result = await extractSchemas({
    oldSchema,
    newSchema,
    mode: 'added',
    schemaType: 'directus',
    outDir: 'dummy',
    subdirFormat: '{name}_{time}',
    dryRun: false,
    store: null,
    parse: parseJSONFile,
    snapshotFile,
  });

  assert.equal(result.dryRun, false);
  assert.equal(result.isSnapshot, true);
  assert.equal(result.file, snapshotFile);

  assert.ok(fs.existsSync(snapshotFile));
  assert.ok(fs.existsSync(metaFile));

  const snapshotContent = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
  assert.deepEqual(snapshotContent.data.fields, [
    { collection: 'orders', field: 'legacy_flag', type: 'boolean' },
    { collection: 'orders', field: 'status', type: 'string' },
    { collection: 'orders', field: 'tracking_number', type: 'string' },
  ]);

  const metaContent = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  assert.equal(metaContent.old, oldSchema);
  assert.equal(result.verification.ok, true);
});

test('extractSchemas: no-dry-run default (no snapshot options) writes split files and meta.json', async () => {
  const oldSchema = path.join(__dirname, '../fixtures/v1.json');
  const newSchema = path.join(__dirname, '../fixtures/v2.json');
  const outDir = getTmpDir();

  const result = await extractSchemas({
    oldSchema,
    newSchema,
    mode: 'added',
    schemaType: 'directus',
    outDir,
    subdirFormat: '{name}_split-run',
    dryRun: false,
    store: null,
    parse: parseJSONFile,
  });

  assert.equal(result.dryRun, false);
  assert.ok(!result.isSnapshot);
  const targetSubdir = path.join(outDir, 'v2_split-run');

  assert.ok(fs.existsSync(path.join(targetSubdir, 'meta.json')));
  const fieldFiles = fs.readdirSync(path.join(targetSubdir, 'field'));
  assert.equal(fieldFiles.length, 1);
  const fieldContent = JSON.parse(fs.readFileSync(path.join(targetSubdir, 'field', fieldFiles[0]), 'utf8'));
  assert.equal(fieldContent.field, 'tracking_number');

  const metaContent = JSON.parse(fs.readFileSync(path.join(targetSubdir, 'meta.json'), 'utf8'));
  assert.equal(metaContent.old, oldSchema);
});

test('verifyMerge: passes for a correct merge in each mode', () => {
  const treeOld = { 'field:a': { v: 1 }, 'field:b': { v: 2 } };
  const treeNew = { 'field:a': { v: 1 }, 'field:b': { v: 99 }, 'field:c': { v: 3 } };
  const result = diff(treeOld, treeNew);

  const addedMerge = { ...treeOld, 'field:c': treeNew['field:c'] };
  assert.equal(verifyMerge(treeOld, addedMerge, result, 'added').ok, true);

  const removedMerge = { 'field:a': treeOld['field:a'] };
  const removedResult = diff(treeOld, { 'field:a': treeOld['field:a'] });
  assert.equal(verifyMerge(treeOld, removedMerge, removedResult, 'removed').ok, true);

  const modifiedMerge = { ...treeOld, 'field:b': treeNew['field:b'] };
  assert.equal(verifyMerge(treeOld, modifiedMerge, result, 'modified').ok, true);
});

test('verifyMerge: catches a deliberately broken merge', () => {
  const treeOld = { 'field:a': { v: 1 }, 'field:b': { v: 2 } };
  const treeNew = { 'field:a': { v: 1 }, 'field:b': { v: 2 }, 'field:c': { v: 3 } };
  const result = diff(treeOld, treeNew);

  // Bug: merge drops the expected added key and introduces an unrelated one.
  const brokenMerge = { ...treeOld, 'field:d': { v: 999 } };
  const verification = verifyMerge(treeOld, brokenMerge, result, 'added');

  assert.equal(verification.ok, false);
  assert.deepEqual(verification.missingKeys, ['field:c']);
  assert.deepEqual(verification.unexpectedAdded, ['field:d']);
});

test('verifyMerge: in a non-matching category, unfiltered entries count as unexpected (documents the single-mode invariant)', () => {
  const treeOld = { 'field:a': { v: 1 } };
  const treeNew = { 'field:a': { v: 1 }, 'field:c': { v: 3 } };
  const result = diff(treeOld, treeNew);

  // mode is 'modified', but the merge also introduces an add — since
  // expectedKeys for 'modified' never includes add-category keys, the
  // entire mergeDiff.added list is flagged, per verifyMerge's documented GOTCHA.
  const mixedMerge = { ...treeOld, 'field:c': treeNew['field:c'] };
  const verification = verifyMerge(treeOld, mixedMerge, result, 'modified');

  assert.equal(verification.ok, false);
  assert.deepEqual(verification.unexpectedAdded, ['field:c']);
});

test('cmdExtract: dry-run --snapshot does not throw even though nothing was written', async () => {
  const oldSchema = path.join(__dirname, '../fixtures/v1.json');
  const newSchema = path.join(__dirname, '../fixtures/v2.json');
  const silence = () => {};
  const restore = [console.log, console.error];
  console.log = silence;
  console.error = silence;
  try {
    await cmdExtract(oldSchema, newSchema, {
      mode: 'added',
      schemaType: 'directus',
      outDir: 'dummy',
      subdirFormat: '{name}_{time}',
      storeDir: getTmpDir(),
      storeType: 'git',
      fileFormat: 'json',
      dryRun: true,
      snapshot: true,
    });
  } finally {
    [console.log, console.error] = restore;
  }
  // no throw = pass; dry-run must never fail even on a bad verification,
  // since nothing was written to disk yet (see cmdExtract's dryRun branch).
});

test('cmdExtract: no-dry-run --snapshot with a passing verification does not throw', async () => {
  const oldSchema = path.join(__dirname, '../fixtures/v1.json');
  const newSchema = path.join(__dirname, '../fixtures/v2.json');
  const outDir = getTmpDir();
  const silence = () => {};
  const restore = [console.log, console.error];
  console.log = silence;
  console.error = silence;
  try {
    await cmdExtract(oldSchema, newSchema, {
      mode: 'added',
      schemaType: 'directus',
      outDir,
      subdirFormat: '{name}_exit-code-run',
      storeDir: getTmpDir(),
      storeType: 'git',
      fileFormat: 'json',
      dryRun: false,
      snapshot: true,
    });
  } finally {
    [console.log, console.error] = restore;
  }
  assert.notEqual(process.exitCode, 1);
});
