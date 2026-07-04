const fs = require('fs');
const path = require('path');
const { getNormalizer } = require('../normalizers');
const { diff } = require('../diff');
const { runSubDir, writeTreeToDir } = require('../../utils/fsTree');
const { buildExtractView } = require('../present/extract');
const { buildTreeSummary } = require('../treeSummary');
const pkg = require('../../../package.json');

/**
 * Builds the meta.json summary for one extract run.
 * @param {import('../normalizers').EntityTree} tree - partial extracted EntityTree
 * @param {string} oldSchema - identifier of old schema
 * @param {string} newSchema - identifier of new schema
 * @param {'added'|'removed'|'modified'} mode
 * @returns {object} extract run metadata
 */
function buildExtractMeta(tree, oldSchema, newSchema, mode) {
  return {
    old: oldSchema,
    new: newSchema,
    mode,
    timestamp: new Date().toISOString(),
    toolVersion: pkg.version,
    ...buildTreeSummary(tree),
  };
}


/**
 * Reconstructs a full EntityTree by overlaying a partial delta tree onto the
 * old tree — used for --snapshot/--snapshot-file output, which must be a
 * complete, applyable schema, not just the isolated changed entities.
 * @param {import('../normalizers').EntityTree} treeOld
 * @param {import('../normalizers').EntityTree} deltaTree - subset keyed by the extract mode
 * @param {'added'|'removed'|'modified'} mode
 * @returns {import('../normalizers').EntityTree}
 */
function mergeIntoOld(treeOld, deltaTree, mode) {
  if (mode === 'removed') {
    const merged = { ...treeOld };
    for (const key of Object.keys(deltaTree)) delete merged[key];
    return merged;
  }
  return { ...treeOld, ...deltaTree };
}

/**
 * Re-diffs treeOld vs the merged tree and asserts the change set matches
 * the mode's key set exactly — catches a bad mergeIntoOld, a stale treeOld,
 * or wrong mode handling before a bad snapshot.json is trusted or written.
 * GOTCHA: for the two categories that don't match `mode`, the *entire*
 * mergeDiff list for that category counts as unexpected (not filtered
 * against expectedKeys) — correct only because extraction is single-mode
 * today, so e.g. `expectedKeys` is always empty for `added`/`removed` when
 * `mode === 'modified'`. If mixed-mode merges are ever supported, this
 * function needs `expectedKeys` split per-category instead of one list.
 * @param {import('../normalizers').EntityTree} treeOld
 * @param {import('../normalizers').EntityTree} merged
 * @param {import('../diff').DiffResult} result - the diff already computed between treeOld and treeNew
 * @param {'added'|'removed'|'modified'} mode
 * @returns {{ok: boolean, unexpectedAdded: string[], unexpectedRemoved: string[], unexpectedModified: string[], missingKeys: string[]}}
 */
function verifyMerge(treeOld, merged, result, mode) {
  const mergeDiff = diff(treeOld, merged);
  const expectedKeys = mode === 'added' ? result.added
    : mode === 'removed' ? result.removed
    : result.modified.map((m) => m.key);

  const actualModifiedKeys = mergeDiff.modified.map((m) => m.key);
  const actualKeys = mode === 'added' ? mergeDiff.added : mode === 'removed' ? mergeDiff.removed : actualModifiedKeys;

  const unexpectedAdded = mode === 'added' ? mergeDiff.added.filter((k) => !expectedKeys.includes(k)) : mergeDiff.added;
  const unexpectedRemoved = mode === 'removed' ? mergeDiff.removed.filter((k) => !expectedKeys.includes(k)) : mergeDiff.removed;
  const unexpectedModified = mode === 'modified' ? actualModifiedKeys.filter((k) => !expectedKeys.includes(k)) : actualModifiedKeys;
  const missingKeys = expectedKeys.filter((k) => !actualKeys.includes(k));

  const ok = unexpectedAdded.length === 0 && unexpectedRemoved.length === 0 && unexpectedModified.length === 0 && missingKeys.length === 0;

  return { ok, unexpectedAdded, unexpectedRemoved, unexpectedModified, missingKeys };
}

/**
 * Extracts a partial EntityTree containing only added-or-only-removed/modified
 * entities between two schemas (file paths or committed version IDs,
 * auto-detected — same rule as diffSchemas in core/operations/diff.js).
 * In dry-run mode (default), returns the partial tree plus the dir it
 * *would* be written to — no files written. Pass dryRun: false to actually write it.
 * @param {{oldSchema: string, newSchema: string, mode: 'added'|'removed'|'modified', schemaType: string, outDir: string, subdirFormat: string, dryRun?: boolean, store: import('../store/store').Store, parse: (filePath: string) => object, snapshot?: boolean, snapshotFile?: string}} params
 * @returns {Promise<{dryRun: true, keys: string[], mode: 'added'|'removed'|'modified', dir: string, tree: import('../normalizers').EntityTree, snapshot?: object, meta?: object, isSnapshot?: boolean} | {dryRun: false, view: ReturnType<typeof buildExtractView>, tree: import('../normalizers').EntityTree, file?: string, isSnapshot?: boolean}>}
 */
async function extractSchemas({ oldSchema, newSchema, mode, schemaType, outDir, subdirFormat, dryRun = true, store, parse, snapshot, snapshotFile }) {
  if (mode !== 'added' && mode !== 'removed' && mode !== 'modified') {
    throw new Error(`Unknown extract mode "${mode}". Available: added, removed, modified`);
  }

  const normalizer = getNormalizer(schemaType);
  const { normalize, denormalize } = normalizer;
  if ((snapshot || snapshotFile) && !denormalize) {
    throw new Error(`Schema normalizer "${schemaType}" does not support rebuilding snapshots.`);
  }

  const oldIsFile = fs.existsSync(oldSchema);
  const newIsFile = fs.existsSync(newSchema);

  // Only 3 arg combos are supported: file+file, hash+file, hash+hash.
  // file+hash (old as file, new as version id) is not a supported combo.
  if (oldIsFile && !newIsFile) {
    throw new Error('Unsupported combo: <old> is a file and <new> is a version id. Supported: file+file, hash+file, hash+hash.');
  }

  let result, treeOld, treeNew;
  if (!oldIsFile && !newIsFile) {
    ({ result, treeOld, treeNew } = await store.diffVersions(oldSchema, newSchema));
  } else {
    const resolveTree = (arg, isFile) =>
      isFile ? normalize(parse(arg)) : store.get(arg);
    [treeOld, treeNew] = await Promise.all([resolveTree(oldSchema, oldIsFile), resolveTree(newSchema, newIsFile)]);
    result = diff(treeOld, treeNew);
  }

  const keys = mode === 'added' ? result.added
    : mode === 'removed' ? result.removed
    : result.modified.map((m) => m.key);
  const sourceTree = mode === 'removed' ? treeOld : treeNew;
  const tree = {};
  for (const key of keys) tree[key] = sourceTree[key];

  const dir = runSubDir(outDir, `${oldSchema}_${newSchema}`, subdirFormat);
  const meta = buildExtractMeta(tree, oldSchema, newSchema, mode);
  const mergedTree = (snapshot || snapshotFile) ? mergeIntoOld(treeOld, tree, mode) : null;
  const verification = mergedTree ? verifyMerge(treeOld, mergedTree, result, mode) : null;

  if (dryRun) {
    if (snapshot || snapshotFile) {
      return {
        dryRun: true,
        keys,
        mode,
        dir,
        tree,
        snapshot: denormalize(mergedTree),
        meta,
        isSnapshot: true,
        verification,
      };
    }
    return { dryRun: true, keys, mode, dir, tree };
  }

  if (snapshotFile) {
    const parentDir = path.dirname(snapshotFile);
    if (parentDir) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    const snapshotData = denormalize(mergedTree);
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshotData, null, 2) + '\n');

    const metaFile = snapshotFile.endsWith('.json')
      ? snapshotFile.slice(0, -5) + '.meta.json'
      : snapshotFile + '.meta.json';
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + '\n');

    return {
      dryRun: false,
      view: buildExtractView(keys, mode, parentDir),
      tree,
      file: snapshotFile,
      isSnapshot: true,
      verification,
    };
  }

  if (snapshot) {
    fs.mkdirSync(dir, { recursive: true });
    const snapshotData = denormalize(mergedTree);
    const file = path.join(dir, 'snapshot.json');
    fs.writeFileSync(file, JSON.stringify(snapshotData, null, 2) + '\n');
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

    return {
      dryRun: false,
      view: buildExtractView(keys, mode, dir),
      tree,
      file,
      isSnapshot: true,
      verification,
    };
  }

  fs.mkdirSync(dir, { recursive: true });
  writeTreeToDir(tree, dir);
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

  return { dryRun: false, view: buildExtractView(keys, mode, dir), tree };
}


module.exports = { extractSchemas, buildExtractMeta, mergeIntoOld, verifyMerge };
