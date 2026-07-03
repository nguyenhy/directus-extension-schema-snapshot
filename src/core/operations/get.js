const { buildGetView } = require('../present/get');

/**
 * Retrieves the original, pre-normalize source exactly as it was committed
 * by `add` — no reconstruction, no denormalize, no merge (contrast with
 * `show`, which reassembles the normalized EntityTree, and `extract`'s
 * `--snapshot`, which overlays a delta onto an old tree). Reusable by
 * cmdGet or a UI backend alike.
 * @param {{id: string, store: import('../store/store').Store}} params
 *   `store` is required — any implementation of the Store contract (see
 *   core/store/store.js). Callers own construction; this function never
 *   assumes git.
 * @returns {Promise<ReturnType<typeof buildGetView>>}
 * @throws if the store has no raw source stored for this id (see
 *   Store.getRaw() — e.g. versions committed before this capability
 *   existed, or committed without a raw source).
 */
async function getRawSourceView({ id, store }) {
  const raw = await store.getRaw(id);
  return buildGetView(id, raw);
}

module.exports = { getRawSourceView };
