const { parseFile } = require('../../utils/parse');
const { getNormalizer } = require('../../core/normalizers');
const { diff } = require('../../core/diff');

/**
 * commander action handler for `diff <schema_old.json> <schema_new.json>`.
 * Normalizes both inputs then prints a +/~/- text summary to stdout.
 * @param {string} oldPath
 * @param {string} newPath
 * @param {{schemaType: string}} options - commander-parsed options
 */
function cmdDiff(oldPath, newPath, options) {
  const { normalize } = getNormalizer(options.schemaType);
  const treeOld = normalize(parseFile(oldPath));
  const treeNew = normalize(parseFile(newPath));
  const result = diff(treeOld, treeNew);

  for (const key of result.added) console.log(`+ ${key}`);
  for (const { key, changes } of result.modified) {
    console.log(`~ ${key}`);
    for (const c of changes) console.log(`    ${c.path}: ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`);
  }
  for (const key of result.removed) console.log(`- ${key}`);

  console.log(`\n${result.added.length} added, ${result.modified.length} modified, ${result.removed.length} removed`);
}

module.exports = { cmdDiff };
