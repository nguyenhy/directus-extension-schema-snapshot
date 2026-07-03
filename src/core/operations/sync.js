const fs = require('fs');
const path = require('path');
const { getNormalizer } = require('../normalizers');
const { readEventLog, activeAddEvents, readSource } = require('../snapshotSync/eventLog');
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
 * `schema-snapshots/meta.json`'s active add events, in log order —
 * `schema-snapshots` is the sole source of truth; `.snapshot/repo` is
 * fully disposable and never diffed against or written to outside of
 * this replay. Always resets `store` first (see store.js's `reset`
 * contract), so the result is exactly what meta.json says exists today:
 * no leftover commits from direct `add`/`remove --latest` activity, no
 * duplicates, no drift. Goes through `store.reset()` rather than
 * touching `storeDir` on disk directly, so this stays correct for any
 * future non-filesystem `Store` implementation, not just `GitStore`.
 * @param {{snapshotsDir: string, schemaType: string, store: import('../store/store').Store, storeDir: string}} params
 * @returns {Promise<{syncedCount: number, syncedHash: string}>}
 */
async function syncSnapshots({ snapshotsDir, schemaType, store, storeDir }) {
  const { normalize } = getNormalizer(schemaType);
  const log = readEventLog(snapshotsDir);
  const active = activeAddEvents(log);

  await store.reset();

  for (const event of active) {
    const raw = readSource(snapshotsDir, event.hash);
    const tree = normalize(raw);
    await store.set(tree, `sync: ${event.id} (${event.hash.slice(0, 7)})`, raw);
  }

  const syncedHash = contentHash(log);
  writeSyncState(storeDir, { syncedHash });
  return { syncedCount: active.length, syncedHash };
}

module.exports = { syncSnapshots, readSyncState, writeSyncState, syncStatePath };
