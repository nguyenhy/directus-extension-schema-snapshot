const { buildShowView } = require('../present/show');

/**
 * Reads a committed version and builds its display view — reusable by
 * cmdShow or a UI backend alike.
 * @param {{id: string, store: import('../store/store').Store}} params
 *   `store` is required — any implementation of the Store contract
 *   (see core/store/store.js). Callers own construction (e.g. `new
 *   GitStore(storeDir)` at the CLI edge); this function never assumes git.
 * @returns {Promise<ReturnType<typeof buildShowView>>}
 */
async function getVersionView({ id, store }) {
  const tree = await store.get(id);
  return buildShowView(id, tree);
}

module.exports = { getVersionView };
