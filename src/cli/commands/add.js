const { parseFile } = require('../../utils/parse');
const { getNormalizer } = require('../../core/normalizers');
const { diff } = require('../../core/diff');
const { GitStore } = require('../../core/store/git');

/**
 * commander action handler for `add <schema.json>`.
 * Normalizes the input, commits it as a new version in the git-backed
 * store, then prints the same +/~/- summary `diff` prints — computed
 * against whatever was the previous version (empty tree on the very
 * first add).
 * @param {string} inputPath - schema.json argument from the CLI
 * @param {{schemaType: string, storeDir: string, message?: string}} options - commander-parsed options
 */
async function cmdAdd(inputPath, options) {
  const { normalize } = getNormalizer(options.schemaType);
  const tree = normalize(parseFile(inputPath));

  const store = new GitStore(options.storeDir);
  const { id, message, previousTree } = await store.set(tree, options.message);

  const result = diff(previousTree, tree);
  console.log(`Version ${id.slice(0, 7)} added${message !== '(no message)' ? ` (${message})` : ''}.`);
  for (const key of result.added) console.log(`+ ${key}`);
  for (const { key, changes } of result.modified) {
    console.log(`~ ${key}`);
    for (const c of changes) console.log(`    ${c.path}: ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`);
  }
  for (const key of result.removed) console.log(`- ${key}`);
}

module.exports = { cmdAdd };
