const { GitStore } = require('../store/git');
const { buildShowView } = require('../present/show');

/**
 * Reads a committed version and builds its display view — reusable by
 * cmdShow or a UI backend alike.
 * @param {{id: string, storeDir: string}} params
 * @returns {Promise<ReturnType<typeof buildShowView>>}
 */
async function getVersionView({ id, storeDir }) {
  const store = new GitStore(storeDir);
  const tree = await store.get(id);
  return buildShowView(id, tree);
}

module.exports = { getVersionView };
