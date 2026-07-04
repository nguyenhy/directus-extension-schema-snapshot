const { readEventLog } = require('../snapshotSync/eventLog');
const { contentHash } = require('../hash');
const { readSyncState } = require('./sync');

/**
 * Read-only comparison of `schema-snapshots/meta.json`'s current hash
 * against the last-synced hash recorded in the store's "sync-state"
 * sidecar (see GitStore.readMeta()). Never mutates anything — contrast
 * with `sync`, which replays events (see
 * docs/proposal-schema-snapshot-sync.md gap 3.8).
 * @param {{snapshotsDir: string, store: import('../store/store').Store}} params
 * @returns {Promise<{inSync: boolean, currentHash: string, syncedHash: string | null}>}
 */
async function statusView({ snapshotsDir, store }) {
  const log = readEventLog(snapshotsDir);
  const currentHash = contentHash(log);
  const { syncedHash } = await readSyncState(store);
  return { inSync: currentHash === syncedHash, currentHash, syncedHash };
}

module.exports = { statusView };
