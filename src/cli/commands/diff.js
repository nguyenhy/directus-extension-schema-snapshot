const fs = require('fs');
const { parseFile } = require('../../utils/parse');
const { getNormalizer } = require('../../core/normalizers');
const { diff } = require('../../core/diff');
const { GitStore } = require('../../core/store/git');

/**
 * One-line detail suffix for any entity key, appended on +/- lines.
 * Fields: "(type, interface)". Relations: "→ related_collection". Others: "".
 */
function entityDetail(key, entity) {
  const kind = key.slice(0, key.indexOf(':'));
  if (kind === 'field') {
    const parts = [];
    if (entity.type) parts.push(entity.type);
    if (entity.meta && entity.meta.interface) parts.push(entity.meta.interface);
    return parts.length ? `  (${parts.join(', ')})` : '';
  }
  if (kind === 'relation') {
    const rel = entity.related_collection || (entity.meta && entity.meta.one_collection);
    return rel ? `  → ${rel}` : '';
  }
  return '';
}

function printDiffResult(result, treeOld, treeNew) {
  for (const key of result.added) {
    console.log(`+ ${key}${entityDetail(key, treeNew[key])}`);
  }
  for (const { key, changes } of result.modified) {
    console.log(`~ ${key}`);
    for (const c of changes) console.log(`    ${c.path}: ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`);
  }
  for (const key of result.removed) {
    console.log(`- ${key}${entityDetail(key, treeOld[key])}`);
  }
  console.log(`\n${result.added.length} added, ${result.modified.length} modified, ${result.removed.length} removed`);
}

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
 * @param {{schemaType: string, storeDir: string}} options
 */
async function cmdDiff(a, b, options) {
  const { normalize } = getNormalizer(options.schemaType);
  const aIsFile = fs.existsSync(a);
  const bIsFile = fs.existsSync(b);

  if (!aIsFile && !bIsFile) {
    // Both are version ids — core handles fetch + sort + diff
    const store = new GitStore(options.storeDir);
    const { result, treeOld, treeNew } = await store.diffVersions(a, b);
    printDiffResult(result, treeOld, treeNew);
    return;
  }

  // At least one is a file — resolve each side, diff in given order
  const store = (!aIsFile || !bIsFile) ? new GitStore(options.storeDir) : null;
  const resolveTree = (arg, isFile) =>
    isFile ? normalize(parseFile(arg)) : store.get(arg);
  const [treeOld, treeNew] = await Promise.all([resolveTree(a, aIsFile), resolveTree(b, bIsFile)]);
  printDiffResult(diff(treeOld, treeNew), treeOld, treeNew);
}

module.exports = { cmdDiff };
