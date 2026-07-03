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
 * When `snapshotsDir` is given, also appends a `remove` event to
 * `meta.json` targeting whatever event is currently at HEAD — without
 * this, `meta.json` would still list the reverted version as active, and
 * the next `sync` would silently resurrect it by replaying it back onto a
 * freshly reset GitStore (see core/operations/sync.js: it rebuilds
 * entirely from `meta.json`'s active events).
 *
 * The target is ALWAYS HEAD's own event id — the specific, immediate
 * thing being undone, never resolved through to some deeper original:
 *   - HEAD is `add`-stamped (`sync: eN (hash)`) -> target = eN.
 *   - HEAD is `remove`-stamped (`remove: eN (removes eM)`) -> target =
 *     eN, HEAD's OWN id — not eM. Undoing a `remove` event means undoing
 *     THAT specific undo, not reaching past it to name what it undid
 *     (e.g. add e1 -> remove e2 (removes e1) -> a 2nd `remove --latest`
 *     produces e3 (removes e2), NOT (removes e1) — see eventLog.js's
 *     activeAddEvents doc comment for how the resulting toggle chain is
 *     resolved to a final active/inactive state for e1).
 * This makes `remove --latest` safely repeatable any number of times —
 * each call just names whatever's on top right now. Uses
 * `appendRemoveEventById` (not `appendRemoveEvent`) because the target
 * may itself be a `remove` event, or an `add` event that's currently
 * inactive — `appendRemoveEvent`'s active-only lookup would reject both.
 *
 * The tombstone's own id is minted BEFORE calling store.removeLatest()
 * (mirrors addVersion's ordering — see core/operations/add.js) and passed
 * in as the revert commit's message via `formatRemoveMessage`, so
 * `list`/present/list.js can label the row instead of showing "-" — the
 * durable id and the commit that represents it must agree from the
 * moment the commit is made, not after a later `sync`. If HEAD predates
 * sync-stamping (or was never synced), there's no target to resolve —
 * both `meta.json` and the commit message fall back to their old,
 * unstamped form, which is correct since no durable id existed for it.
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
 * rewrites prior events (proposal gap 3.6). Distinct from
 * removeLatestVersion() (git-revert based, local GitStore cache only);
 * this is the sync-able, cross-device removal path (proposal gap 3.4).
 *
 * UNLIKE removeLatestVersion(), this can tombstone ANY active event, not
 * just the most recently active one — `appendRemoveEvent` resolves by
 * hash or eventId across the full active set (eventLog.js:activeAddEvents),
 * with no "must be newest" constraint. That's fine for meta.json itself
 * (a tombstone is just a reference, order-independent), but
 * core/operations/sync.js's replay CANNOT currently reconstruct this
 * correctly if the target isn't the newest active add at replay time —
 * see sync.js's KNOWN LIMITATION doc comment on syncSnapshots. If this
 * function's arbitrary-position capability is ever exercised in practice
 * (today only reachable via `remove --hash`/`--id`, never `--latest`),
 * `sync` must be updated in lockstep or it will throw (by design, not
 * silently corrupt) the moment it hits such an event.
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
