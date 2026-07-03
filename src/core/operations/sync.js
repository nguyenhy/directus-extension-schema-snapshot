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
 * `schema-snapshots/meta.json`'s full event log (add AND remove, not just
 * active adds), replayed in log order — `schema-snapshots` is the sole
 * source of truth, `.snapshot/repo` is fully disposable. Always
 * `store.reset()`s first, so the result is meta.json's entire history
 * with no leftover commits from direct `add`/`remove --latest` activity.
 *
 * KNOWN LIMITATION: `remove` events replay via `store.removeLatest()`,
 * which can only revert current HEAD (no Store implementation supports
 * reverting an arbitrary historical commit — see store/store.js). Safe
 * for every `remove --latest`-produced event (always targets whatever's
 * actually at HEAD, see core/operations/remove.js). NOT safe for
 * `remove --hash`/`--id` targeting a non-newest active event (see
 * eventLog.js's appendRemoveEvent) — replaying that would revert the
 * wrong commit. `expectedTarget` tracks "what's at HEAD" through the
 * replay and throws rather than silently mis-rebuilding if a `remove`
 * event doesn't match it. Fixing this for real needs a
 * remove-this-specific-commit Store operation, not a revert of HEAD.
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
