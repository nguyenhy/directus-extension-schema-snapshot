const path = require('path');
const fs = require('../platform/fs');
const { getNormalizer } = require('../normalizers');
const { diff } = require('../diff');
const { buildDiffView } = require('../present/diff');
const { buildExtractView } = require('../present/extract');
const { runSubDir } = require('../../utils/fsTree');
const { buildTreeSummary } = require('../treeSummary');
const pkg = require('../../../package.json');
const { UnknownExtractModeError, SchemaSnapshotError } = require('../errors');

/**
 * Builds the meta.json summary for one --snapshot run.
 * @param {import('../normalizers').EntityTree} tree - partial extracted EntityTree
 * @param {string} oldSchema - identifier of old schema
 * @param {string} newSchema - identifier of new schema
 * @param {'added'|'removed'|'modified'} mode
 * @returns {object} run metadata
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
 * old tree — used for `--snapshot` output, which must be a complete,
 * applyable schema, not just the isolated changed entities.
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
 * Diffs two schemas — file paths or committed version IDs (auto-detected)
 * — and builds the display view, OR (with `show`/`snapshotMode`) filters
 * or writes a single category of the diff. Reusable by cmdDiff or a UI
 * backend alike. Absorbs what used to be the separate `extract` operation:
 * `extract <a> <b> --mode X --snapshot --no-dry-run` is now
 * `diff <a> <b> --snapshot X`.
 *
 * Per-argument auto-detection:
 *   - Existing file path → normalize(parse(path))
 *   - Otherwise → id resolved via `store`
 * When both args are version ids, delegates to store.diffVersions() which
 * owns auto-sort (always diffs old→new regardless of arg order).
 * When either arg is a file, order is respected as given.
 *
 * @param {{
 *   a: string, b: string, schemaType: string,
 *   store: import('../store/store').Store, parse: (filePath: string) => object,
 *   show?: 'added'|'removed'|'modified',
 *   snapshotMode?: 'added'|'removed'|'modified',
 *   snapshotFile?: string,
 *   outDir?: string, subdirFormat?: string, dryRun?: boolean,
 *   refA?: string, refB?: string,
 * }} params
 *   `store` and `parse` are required, injected dependencies — see
 *   core/operations/add.js for the rationale. `show` is a view-only
 *   category filter (never writes). `snapshotMode` writes a full
 *   denormalized snapshot for one category — to `outDir`/a fresh subdir
 *   by default, or to `snapshotFile` if given. `refA`/`refB` are the
 *   *original* CLI args (e.g. "e1"/"e2") before the caller resolved them to
 *   `a`/`b` — used only for the subdir name (see runSubDir's {ref1}/{ref2}),
 *   defaulting to `a`/`b` themselves when omitted (e.g. file-path args).
 * @returns {Promise<ReturnType<typeof buildDiffView> | object>}
 */
async function diffSchemas({ a, b, schemaType, store, parse, show, snapshotMode, snapshotFile, outDir, subdirFormat, dryRun = true, refA = a, refB = b }) {
  const { normalize, denormalize } = getNormalizer(schemaType);
  const aIsFile = fs.exists(a);
  const bIsFile = fs.exists(b);

  let result, treeOld, treeNew;
  if (!aIsFile && !bIsFile) {
    ({ result, treeOld, treeNew } = await store.diffVersions(a, b));
  } else {
    const resolveTree = (arg, isFile) =>
      isFile ? normalize(parse(arg)) : store.get(arg);
    [treeOld, treeNew] = await Promise.all([resolveTree(a, aIsFile), resolveTree(b, bIsFile)]);
    result = diff(treeOld, treeNew);
  }

  if (!show && !snapshotMode) {
    return buildDiffView(result, treeOld, treeNew);
  }

  const mode = snapshotMode || show;
  if (mode !== 'added' && mode !== 'removed' && mode !== 'modified') {
    throw new UnknownExtractModeError(`Unknown mode "${mode}". Available: added, removed, modified`);
  }

  const keys = mode === 'added' ? result.added
    : mode === 'removed' ? result.removed
    : result.modified.map((m) => m.key);
  const sourceTree = mode === 'removed' ? treeOld : treeNew;
  const tree = {};
  for (const key of keys) tree[key] = sourceTree[key];

  if (!snapshotMode) {
    // --show: view-only category filter, never writes.
    return { mode, keys, count: keys.length, tree };
  }

  if (!denormalize) {
    throw new SchemaSnapshotError(`Schema normalizer "${schemaType}" does not support rebuilding snapshots.`);
  }

  const dir = runSubDir(outDir, `${a}_${b}`, subdirFormat, { ref1: refA, ref2: refB, mode });
  const meta = buildExtractMeta(tree, a, b, mode);
  const mergedTree = mergeIntoOld(treeOld, tree, mode);
  const verification = verifyMerge(treeOld, mergedTree, result, mode);
  const snapshotData = denormalize(mergedTree);

  if (dryRun) {
    return { dryRun: true, keys, mode, dir, tree, snapshot: snapshotData, meta, isSnapshot: true, verification, file: snapshotFile };
  }

  if (snapshotFile) {
    const parentDir = path.dirname(snapshotFile);
    if (parentDir) fs.mkdir(parentDir);
    fs.writeFile(snapshotFile, JSON.stringify(snapshotData, null, 2) + '\n');

    const metaFile = snapshotFile.endsWith('.json')
      ? snapshotFile.slice(0, -5) + '.meta.json'
      : snapshotFile + '.meta.json';
    fs.writeFile(metaFile, JSON.stringify(meta, null, 2) + '\n');

    return { dryRun: false, view: buildExtractView(keys, mode, parentDir), tree, file: snapshotFile, isSnapshot: true, verification };
  }

  fs.mkdir(dir);
  const file = path.join(dir, 'snapshot.json');
  fs.writeFile(file, JSON.stringify(snapshotData, null, 2) + '\n');
  fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

  return { dryRun: false, view: buildExtractView(keys, mode, dir), tree, file, isSnapshot: true, verification };
}

module.exports = { diffSchemas, buildExtractMeta, mergeIntoOld, verifyMerge };
