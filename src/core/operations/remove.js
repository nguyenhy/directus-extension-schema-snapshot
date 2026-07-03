const { buildRemoveView } = require('../present/remove');
const {
  readEventLog,
  writeEventLog,
  appendRemoveEvent,
  appendRemoveEventById,
  parseSyncMessage,
  parseRemoveMessage,
  nextEventId,
  formatRemoveMessage,
} = require('../snapshotSync/eventLog');

/**
 * Removes the most recently committed version — the full "remove --latest"
 * operation, independent of CLI vs UI. Delegates the actual undo to
 * store.removeLatest(), which every Store implementation must do
 * non-destructively (see core/store/store.js). No confirmation prompt
 * here — that's CLI-specific UX, owned by cmdRemove.
 *
 * When `snapshotsDir` is given, also appends a `remove` event targeting
 * HEAD's own event id — read from HEAD's stamped commit message, `add`
 * (`sync: eN (hash)`) or `remove` (`remove: eN (removes eM)`, target =
 * eN, not eM: undoing a remove means undoing that specific action, not
 * reaching past it — see eventLog.js's activeAddEvents for the resulting
 * toggle-chain model). This makes `remove --latest` safely repeatable any
 * number of times, and keeps `meta.json` in sync so a later `sync` can't
 * resurrect what this call removed (core/operations/sync.js rebuilds
 * entirely from `meta.json`). Uses `appendRemoveEventById` (not
 * `appendRemoveEvent`) since the target may be a `remove` event or a
 * currently-inactive `add` — both rejected by `appendRemoveEvent`'s
 * active-only lookup.
 *
 * The tombstone's id is minted before store.removeLatest() and passed in
 * as the commit message (mirrors addVersion's ordering), so `list` can
 * label the row immediately, no separate `sync` needed. If HEAD predates
 * sync-stamping, there's no target to resolve — both fall back to the
 * old, unstamped form, correct since no durable id existed for it.
 * @param {{store: import('../store/store').Store, snapshotsDir?: string}} params
 *   `store` is required — see core/operations/show.js for the rationale.
 * @returns {Promise<ReturnType<typeof buildRemoveView>>}
 */
async function removeLatestVersion({ store, snapshotsDir }) {
  let log, targetId, commitMessage;
  if (snapshotsDir) {
    const [topVersion] = await store.list();
    const syncMatch = topVersion && parseSyncMessage(topVersion.message);
    const removeMatch = topVersion && parseRemoveMessage(topVersion.message);
    if (syncMatch && syncMatch.event !== '-') targetId = syncMatch.event;
    else if (removeMatch) targetId = removeMatch.event; // HEAD's own id — undo THAT specific action, not what it undid

    if (targetId) {
      log = readEventLog(snapshotsDir);
      commitMessage = formatRemoveMessage(nextEventId(log), targetId);
    }
  }

  const { id, revertedId, previousTree, tree } = await store.removeLatest(commitMessage);

  if (targetId) {
    appendRemoveEventById(log, targetId); // mints the same id we already stamped the commit with
    writeEventLog(snapshotsDir, log);
  }

  return buildRemoveView(id, revertedId, previousTree, tree);
}

/**
 * Appends a tombstone `remove` event to `schema-snapshots/meta.json` for a
 * hash or explicit event id — never touches `source/*.json`, never
 * rewrites prior events. Distinct from removeLatestVersion() (git-revert
 * based, local GitStore cache only); this is the sync-able, cross-device
 * removal path, and unlike removeLatestVersion() can target ANY active
 * event, not just the newest.
 *
 * CAUTION: targeting a non-newest active event makes the resulting log
 * un-replayable by `sync` — see sync.js's KNOWN LIMITATION doc comment.
 * `sync` will throw (not silently corrupt) rather than mis-rebuild.
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
