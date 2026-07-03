const fs = require('fs');
const path = require('path');
const { getNormalizer } = require('../normalizers');
const { readEventLog, readSource, formatSyncMessage, formatRemoveMessage } = require('../snapshotSync/eventLog');
const { contentHash } = require('../hash');

function syncStatePath(storeDir) {
  return path.join(path.dirname(storeDir), 'sync-state.json');
}

/**
 * @param {string} storeDir - local GitStore cache dir (e.g. ".snapshot/repo")
 * @returns {{syncedHash: string | null}}
 */
function readSyncState(storeDir) {
  const p = syncStatePath(storeDir);
  if (!fs.existsSync(p)) return { syncedHash: null };
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeSyncState(storeDir, state) {
  fs.mkdirSync(path.dirname(syncStatePath(storeDir)), { recursive: true });
  fs.writeFileSync(syncStatePath(storeDir), JSON.stringify(state, null, 2));
}

/**
 * Rebuilds the local GitStore cache from scratch out of
 * `schema-snapshots/meta.json`'s FULL event log, replayed in log order —
 * `schema-snapshots` is the sole source of truth; `.snapshot/repo` is
 * fully disposable and never diffed against or written to outside of
 * this replay. Always resets `store` first (see store.js's `reset`
 * contract), so the result reproduces meta.json's entire history,
 * add and remove events alike (list-visible identity, not just current
 * content) — no leftover commits from direct `add`/`remove --latest`
 * activity, no duplicates, no drift. Goes through `store.reset()` rather
 * than touching `storeDir` on disk directly, so this stays correct for
 * any future non-filesystem `Store` implementation, not just `GitStore`.
 *
 * KNOWN LIMITATION — read before adding arbitrary-position removal:
 * a `remove` event is replayed via `store.removeLatest()`, which can only
 * revert whatever commit is currently HEAD in the replay (see
 * store/store.js's `removeLatest` contract — there is no "revert this
 * specific historical commit" operation, `remove <id> --force` was
 * deliberately never built, see core/operations/remove.js's docstring).
 * That's safe for every `remove` event produced by `remove --latest`
 * (core/operations/remove.js's removeLatestVersion): every `remove`
 * event's `removes` field always names the SPECIFIC event that was at
 * HEAD when it was created — an `add` event, or another `remove` event
 * (undoing that undo — see eventLog.js's activeAddEvents doc comment) —
 * never resolved through to some deeper original. `expectedTarget` below
 * tracks "what event id is currently at HEAD" through the replay: the
 * current event's own id, always, after processing it (whether it was an
 * `add` or a `remove` — a `remove` commit's own id becomes the new HEAD
 * exactly like an `add` commit's does). Requiring each `remove` event to
 * match `expectedTarget` before processing it enforces the exact
 * invariant live execution upholds, and throws rather than silently
 * rebuilding wrong history if it doesn't.
 *
 * IF arbitrary-position removal is ever added (removeSnapshotEvent /
 * `remove --hash`|`--id` already allows tombstoning any active event, not
 * just the newest — see eventLog.js's appendRemoveEvent) — THIS FUNCTION
 * MUST CHANGE TOO. Replaying such an event via `removeLatest()` would
 * revert whatever unrelated commit happens to be HEAD at that point,
 * silently corrupting the rebuild. Fixing it needs a real "remove this
 * specific version's contribution from history" operation on `Store` —
 * not a revert of HEAD — since `git revert HEAD` only ever undoes the
 * single most recent commit.
 * @param {{snapshotsDir: string, schemaType: string, store: import('../store/store').Store, storeDir: string}} params
 * @returns {Promise<{syncedCount: number, syncedHash: string}>}
 * @throws {Error} if a `remove` event doesn't match what live execution
 *   would have targeted at that point — see the KNOWN LIMITATION note
 */
async function syncSnapshots({ snapshotsDir, schemaType, store, storeDir }) {
  const { normalize } = getNormalizer(schemaType);
  const log = readEventLog(snapshotsDir);

  await store.reset();

  let expectedTarget; // event id currently at HEAD in the replay, mirrors removeLatestVersion's live resolution
  let syncedCount = 0;

  for (const event of log.events) {
    if (event.type === 'add') {
      const raw = readSource(snapshotsDir, event.hash);
      const tree = normalize(raw);
      await store.set(tree, formatSyncMessage(event.id, event.hash), raw);
      expectedTarget = event.id;
      syncedCount++;
    } else if (event.type === 'remove') {
      if (event.removes !== expectedTarget) {
        throw new Error(
          `Cannot sync: remove event "${event.id}" targets "${event.removes}", but live execution at this point would have targeted "${expectedTarget}" — ` +
            'replaying an arbitrary-position removal requires reverting a specific historical commit, which GitStore.removeLatest() ' +
            'cannot do (it only reverts HEAD). See sync.js\'s KNOWN LIMITATION doc comment.'
        );
      }
      await store.removeLatest(formatRemoveMessage(event.id, event.removes));
      expectedTarget = event.id; // this remove commit's own id is now at HEAD
      syncedCount++;
    }
  }

  const syncedHash = contentHash(log);
  writeSyncState(storeDir, { syncedHash });
  return { syncedCount, syncedHash };
}

module.exports = { syncSnapshots, readSyncState, writeSyncState, syncStatePath };
