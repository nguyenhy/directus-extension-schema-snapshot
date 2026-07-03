const { parseFile } = require('../../utils/parse');
const { getNormalizer } = require('../normalizers');
const { diff } = require('../diff');
const { GitStore } = require('../store/git');
const { buildAddView } = require('../present/add');

/**
 * Normalizes a schema file and commits it as a new version — the full
 * "add" operation, independent of CLI vs UI. Callers (cmdAdd, a UI
 * backend, etc.) just choose how to render the returned view.
 * @param {{inputPath: string, schemaType: string, storeDir: string, message?: string}} params
 * @returns {Promise<ReturnType<typeof buildAddView>>}
 */
async function addVersion({ inputPath, schemaType, storeDir, message }) {
  const { normalize } = getNormalizer(schemaType);
  const tree = normalize(parseFile(inputPath));

  const store = new GitStore(storeDir);
  const { id, message: committedMessage, previousTree } = await store.set(tree, message);

  const result = diff(previousTree, tree);
  return buildAddView(id, committedMessage, result, previousTree, tree);
}

module.exports = { addVersion };
