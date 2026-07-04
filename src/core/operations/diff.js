const fs = require('../platform/fs');
const { getNormalizer } = require('../normalizers');
const { diff } = require('../diff');
const { buildDiffView } = require('../present/diff');

/**
 * Diffs two schemas — file paths or committed version IDs (auto-detected)
 * — and builds the display view. Reusable by cmdDiff or a UI backend alike.
 *
 * Per-argument auto-detection:
 *   - Existing file path → normalize(parse(path))
 *   - Otherwise → id resolved via `store`
 * When both args are version ids, delegates to store.diffVersions() which
 * owns auto-sort (always diffs old→new regardless of arg order).
 * When either arg is a file, order is respected as given.
 *
 * @param {{a: string, b: string, schemaType: string, store: import('../store/store').Store, parse: (filePath: string) => object}} params
 *   `store` and `parse` are required, injected dependencies — see
 *   core/operations/add.js for the rationale.
 * @returns {Promise<ReturnType<typeof buildDiffView>>}
 */
async function diffSchemas({ a, b, schemaType, store, parse }) {
  const { normalize } = getNormalizer(schemaType);
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

  return buildDiffView(result, treeOld, treeNew);
}

module.exports = { diffSchemas };
