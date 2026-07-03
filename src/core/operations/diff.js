const fs = require('fs');
const { parseFile } = require('../../utils/parse');
const { getNormalizer } = require('../normalizers');
const { diff } = require('../diff');
const { GitStore } = require('../store/git');
const { buildDiffView } = require('../present/diff');

/**
 * Diffs two schemas — file paths or committed version IDs (auto-detected)
 * — and builds the display view. Reusable by cmdDiff or a UI backend alike.
 *
 * Per-argument auto-detection:
 *   - Existing file path → normalize(parseFile(path))
 *   - Otherwise → commit SHA resolved via GitStore
 * When both args are version ids, delegates to GitStore.diffVersions() which
 * owns auto-sort (always diffs old→new regardless of arg order).
 * When either arg is a file, order is respected as given.
 *
 * @param {{a: string, b: string, schemaType: string, storeDir: string}} params
 * @returns {Promise<ReturnType<typeof buildDiffView>>}
 */
async function diffSchemas({ a, b, schemaType, storeDir }) {
  const { normalize } = getNormalizer(schemaType);
  const aIsFile = fs.existsSync(a);
  const bIsFile = fs.existsSync(b);

  let result, treeOld, treeNew;
  if (!aIsFile && !bIsFile) {
    const store = new GitStore(storeDir);
    ({ result, treeOld, treeNew } = await store.diffVersions(a, b));
  } else {
    const store = (!aIsFile || !bIsFile) ? new GitStore(storeDir) : null;
    const resolveTree = (arg, isFile) =>
      isFile ? normalize(parseFile(arg)) : store.get(arg);
    [treeOld, treeNew] = await Promise.all([resolveTree(a, aIsFile), resolveTree(b, bIsFile)]);
    result = diff(treeOld, treeNew);
  }

  return buildDiffView(result, treeOld, treeNew);
}

module.exports = { diffSchemas };
