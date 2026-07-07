const path = require('path');
const fs = require('../platform/fs');
const { getNormalizer } = require('../normalizers');
const { diff } = require('../diff');
const { runSubDir, writeTreeToDir } = require('../../utils/fsTree');
const { buildExtractView } = require('../present/extract');
const { UnknownExtractModeError, UnsupportedComboError } = require('../errors');
const { diffSchemas, buildExtractMeta, mergeIntoOld, verifyMerge } = require('./diff');

/**
 * @deprecated use diffSchemas({ ..., snapshotMode, snapshotFile }) from
 * core/operations/diff.js instead — `extract <old> <new> --mode X --snapshot
 * --no-dry-run` is now `diff <old> <new> --snapshot X`. Kept for the
 * `extract` CLI command's back-compat flags; delegates to diffSchemas for
 * the --snapshot/--snapshot-file cases (buildExtractMeta/mergeIntoOld/
 * verifyMerge now live in diff.js, re-exported here for existing callers).
 *
 * Extracts a partial EntityTree containing only added-or-only-removed/modified
 * entities between two schemas (file paths or committed version IDs,
 * auto-detected — same rule as diffSchemas). In dry-run mode (default),
 * returns the partial tree plus the dir it *would* be written to — no files
 * written. Pass dryRun: false to actually write it.
 * @param {{oldSchema: string, newSchema: string, mode: 'added'|'removed'|'modified', schemaType: string, outDir: string, subdirFormat: string, dryRun?: boolean, store: import('../store/store').Store, parse: (filePath: string) => object, snapshot?: boolean, snapshotFile?: string, refOld?: string, refNew?: string}} params
 *   `refOld`/`refNew` are the original CLI args before the caller resolved
 *   them to `oldSchema`/`newSchema` — used only for the subdir name (see
 *   diffSchemas'/runSubDir's {ref1}/{ref2}), defaulting to
 *   `oldSchema`/`newSchema` when omitted.
 * @returns {Promise<{dryRun: true, keys: string[], mode: 'added'|'removed'|'modified', dir: string, tree: import('../normalizers').EntityTree, snapshot?: object, meta?: object, isSnapshot?: boolean, verification?: object} | {dryRun: false, view: ReturnType<typeof buildExtractView>, tree: import('../normalizers').EntityTree, file?: string, isSnapshot?: boolean, verification?: object}>}
 */
async function extractSchemas({ oldSchema, newSchema, mode, schemaType, outDir, subdirFormat, dryRun = true, store, parse, snapshot, snapshotFile, refOld = oldSchema, refNew = newSchema }) {
  if (mode !== 'added' && mode !== 'removed' && mode !== 'modified') {
    throw new UnknownExtractModeError(`Unknown extract mode "${mode}". Available: added, removed, modified`);
  }

  if (snapshot || snapshotFile) {
    return diffSchemas({
      a: oldSchema, b: newSchema, schemaType, store, parse,
      snapshotMode: mode, snapshotFile, outDir, subdirFormat, dryRun,
      refA: refOld, refB: refNew,
    });
  }

  // Legacy plain path (no --snapshot/--snapshot-file): writes one file per
  // extracted entity, not a full denormalized snapshot — diffSchemas
  // dropped this format, so it stays here for old `extract` callers only.
  const { normalize } = getNormalizer(schemaType);
  const oldIsFile = fs.exists(oldSchema);
  const newIsFile = fs.exists(newSchema);

  // Only 3 arg combos are supported: file+file, hash+file, hash+hash.
  // file+hash (old as file, new as version id) is not a supported combo.
  if (oldIsFile && !newIsFile) {
    throw new UnsupportedComboError('Unsupported combo: <old> is a file and <new> is a version id. Supported: file+file, hash+file, hash+hash.');
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

  const dir = runSubDir(outDir, `${oldSchema}_${newSchema}`, subdirFormat, { ref1: refOld, ref2: refNew, mode });

  if (dryRun) {
    return { dryRun: true, keys, mode, dir, tree };
  }

  fs.mkdir(dir);
  writeTreeToDir(tree, dir);
  fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(buildExtractMeta(tree, oldSchema, newSchema, mode), null, 2) + '\n');

  return { dryRun: false, view: buildExtractView(keys, mode, dir), tree };
}

module.exports = { extractSchemas, buildExtractMeta, mergeIntoOld, verifyMerge };
