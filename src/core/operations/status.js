const { readEventLog } = require('../snapshotSync/eventLog');
const { contentHash } = require('../hash');
const { readSyncState } = require('./sync');

/**
 * Read-only comparison of `schema-snapshots/meta.json`'s current hash
 * against the last-synced hash recorded in `.snapshot/sync-state.json`.
 * Never mutates anything — contrast with `sync`, which replays events
 * (see docs/proposal-schema-snapshot-sync.md gap 3.8).
 * @param {{snapshotsDir: string, storeDir: string}} params
 * @returns {{inSync: boolean, currentHash: string, syncedHash: string | null}}
 */
function statusView({ snapshotsDir, storeDir }) {
  const log = readEventLog(snapshotsDir);
  const currentHash = contentHash(log);
  const { syncedHash } = readSyncState(storeDir);
  return { inSync: currentHash === syncedHash, currentHash, syncedHash };
}

module.exports = { statusView };
