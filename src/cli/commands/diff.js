const fs = require('fs');
const { parseFile } = require('../../utils/parse');
const { getNormalizer } = require('../../core/normalizers');
const { diff } = require('../../core/diff');
const { GitStore } = require('../../core/store/git');
const { buildDiffView } = require('../../core/present/diff');
const { printDiffView } = require('../render/diff');

/**
 * commander action handler for `diff <a> <b>`.
 *
 * Per-argument auto-detection:
 *   - Existing file path → normalize(parseFile(path))
 *   - Otherwise → commit SHA resolved via GitStore
 *
 * When both args are version ids, delegates to GitStore.diffVersions() which
 * owns auto-sort (always diffs old→new regardless of arg order).
 * When either arg is a file, order is respected as given.
 *
 * @param {string} a
 * @param {string} b
 * @param {{schemaType: string, storeDir: string, json?: boolean}} options
 */
async function cmdDiff(a, b, options) {
  const { normalize } = getNormalizer(options.schemaType);
  const aIsFile = fs.existsSync(a);
  const bIsFile = fs.existsSync(b);

  let result, treeOld, treeNew;
  if (!aIsFile && !bIsFile) {
    // Both are version ids — core handles fetch + sort + diff
    const store = new GitStore(options.storeDir);
    ({ result, treeOld, treeNew } = await store.diffVersions(a, b));
  } else {
    // At least one is a file — resolve each side, diff in given order
    const store = (!aIsFile || !bIsFile) ? new GitStore(options.storeDir) : null;
    const resolveTree = (arg, isFile) =>
      isFile ? normalize(parseFile(arg)) : store.get(arg);
    [treeOld, treeNew] = await Promise.all([resolveTree(a, aIsFile), resolveTree(b, bIsFile)]);
    result = diff(treeOld, treeNew);
  }

  const view = buildDiffView(result, treeOld, treeNew);
  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    return;
  }
  printDiffView(view);
}

module.exports = { cmdDiff };
