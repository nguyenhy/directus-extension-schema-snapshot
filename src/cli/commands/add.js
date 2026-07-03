const { parseFile } = require('../../utils/parse');
const { getNormalizer } = require('../../core/normalizers');
const { diff } = require('../../core/diff');
const { GitStore } = require('../../core/store/git');
const { buildAddView } = require('../../core/present/add');
const { printAddView } = require('../render/add');

/**
 * commander action handler for `add <schema.json>`.
 * Normalizes the input, commits it as a new version in the git-backed
 * store, then prints the same +/~/- summary `diff` prints — computed
 * against whatever was the previous version (empty tree on the very
 * first add).
 * @param {string} inputPath - schema.json argument from the CLI
 * @param {{schemaType: string, storeDir: string, message?: string, json?: boolean}} options - commander-parsed options
 */
async function cmdAdd(inputPath, options) {
  const { normalize } = getNormalizer(options.schemaType);
  const tree = normalize(parseFile(inputPath));

  const store = new GitStore(options.storeDir);
  const { id, message, previousTree } = await store.set(tree, options.message);

  const result = diff(previousTree, tree);
  const view = buildAddView(id, message, result, previousTree, tree);

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    return;
  }
  printAddView(view);
}

module.exports = { cmdAdd };
