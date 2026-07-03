const { buildRemoveView } = require('../present/remove');

/**
 * Removes the most recently committed version — the full "remove --latest"
 * operation, independent of CLI vs UI. Delegates the actual undo to
 * store.removeLatest(), which every Store implementation must do
 * non-destructively (see core/store/store.js). No confirmation prompt
 * here — that's CLI-specific UX, owned by cmdRemove.
 * @param {{store: import('../store/store').Store}} params
 *   `store` is required — see core/operations/show.js for the rationale.
 * @returns {Promise<ReturnType<typeof buildRemoveView>>}
 */
async function removeLatestVersion({ store }) {
  const { id, revertedId, previousTree, tree } = await store.removeLatest();
  return buildRemoveView(id, revertedId, previousTree, tree);
}

module.exports = { removeLatestVersion };
