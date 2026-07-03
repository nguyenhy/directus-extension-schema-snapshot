const { GitStore } = require('../store/git');
const { buildListView } = require('../present/list');

/**
 * Lists all committed versions and builds their display view — reusable
 * by cmdList or a UI backend alike.
 * @param {{storeDir: string}} params
 * @returns {Promise<ReturnType<typeof buildListView>>}
 */
async function listVersionsView({ storeDir }) {
  const store = new GitStore(storeDir);
  const versions = await store.list();
  return buildListView(versions);
}

module.exports = { listVersionsView };
