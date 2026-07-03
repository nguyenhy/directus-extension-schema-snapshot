const { buildListView } = require('../present/list');

/**
 * Lists all committed versions and builds their display view — reusable
 * by cmdList or a UI backend alike.
 * @param {{store: import('../store/store').Store}} params
 *   `store` is required — see core/operations/show.js for the rationale.
 * @returns {Promise<ReturnType<typeof buildListView>>}
 */
async function listVersionsView({ store }) {
  const versions = await store.list();
  return buildListView(versions);
}

module.exports = { listVersionsView };
