const { buildRemoveView } = require('../present/remove');
const { readEventLog, writeEventLog, appendRemoveEvent } = require('../snapshotSync/eventLog');

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

/**
 * Appends a tombstone `remove` event to `schema-snapshots/meta.json` for a
 * hash or explicit event id — never touches `source/*.json`, never
 * rewrites prior events (proposal gap 3.6). Distinct from
 * removeLatestVersion() (git-revert based, local GitStore cache only);
 * this is the sync-able, cross-device removal path (proposal gap 3.4).
 * @param {{snapshotsDir: string, hash?: string, eventId?: string}} params
 * @returns {object} the appended remove event
 * @throws {Error} if no active add event matches hash/eventId
 */
function removeSnapshotEvent({ snapshotsDir, hash, eventId }) {
  const log = readEventLog(snapshotsDir);
  const event = appendRemoveEvent(log, { hash, eventId });
  writeEventLog(snapshotsDir, log);
  return event;
}

module.exports = { removeLatestVersion, removeSnapshotEvent };
