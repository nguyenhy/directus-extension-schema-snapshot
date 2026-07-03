const fs = require('fs');
const { getNormalizer } = require('../normalizers');
const { diff } = require('../diff');
const { runSubDir, writeTreeToDir } = require('../../utils/fsTree');
const { buildExtractView } = require('../present/extract');

/**
 * Extracts a partial EntityTree containing only added-or-only-removed
 * entities between two schemas (file paths or committed version IDs,
 * auto-detected — same rule as diffSchemas in core/operations/diff.js).
 * In dry-run mode (default), returns the partial tree plus the dir it
 * *would* be written to (runSubDir is pure path computation, no fs access)
 * — no files written. Pass dryRun: false to actually write it via
 * writeTreeToDir/runSubDir, the same on-disk layout `normalize` uses, so it
 * round-trips through `add`/`show --json` like any other tree.
 * @param {{oldSchema: string, newSchema: string, mode: 'added'|'removed'|'modified', schemaType: string, outDir: string, subdirFormat: string, dryRun?: boolean, store: import('../store/store').Store, parse: (filePath: string) => object}} params
 *   `store` and `parse` are required, injected dependencies — see
 *   core/operations/add.js for the rationale.
 * @returns {Promise<{dryRun: true, keys: string[], mode: 'added'|'removed'|'modified', dir: string, tree: import('../normalizers').EntityTree} | {dryRun: false, view: ReturnType<typeof buildExtractView>, tree: import('../normalizers').EntityTree}>}
 */
async function extractSchemas({ oldSchema, newSchema, mode, schemaType, outDir, subdirFormat, dryRun = true, store, parse }) {
  if (mode !== 'added' && mode !== 'removed' && mode !== 'modified') {
    throw new Error(`Unknown extract mode "${mode}". Available: added, removed, modified`);
  }

  const { normalize } = getNormalizer(schemaType);
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

  if (dryRun) {
    return { dryRun: true, keys, mode, dir, tree };
  }

  fs.mkdirSync(dir, { recursive: true });
  writeTreeToDir(tree, dir);

  return { dryRun: false, view: buildExtractView(keys, mode, dir), tree };
}

module.exports = { extractSchemas };
