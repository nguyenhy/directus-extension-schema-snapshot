const { parseSyncMessage } = require('../snapshotSync/eventLog');

/**
 * Builds a render-agnostic view of the version list. Each version carries
 * both the GitStore commit sha (`shortId` — a disposable cache ref,
 * unstable across `sync`) and, when the commit came from `sync`, the
 * durable `event`/`hash` identity from `schema-snapshots/meta.json`.
 * Versions not produced by `sync` (e.g. `add` before dual-write existed,
 * or a custom `-m` message) show `event`/`hash` as "-".
 * @param {{id: string, timestamp: string, message: string}[]} versions - newest first
 * @returns {{count: number, versions: {id: string, shortId: string, event: string, hash: string, timestamp: string, message: string}[]}}
 */
function buildListView(versions) {
  return {
    count: versions.length,
    versions: versions.map((v) => {
      const { event, hash } = parseSyncMessage(v.message);
      return {
        id: v.id,
        shortId: v.id.slice(0, 7),
        event,
        hash,
        timestamp: new Date(v.timestamp).toISOString().replace('T', ' ').slice(0, 19),
        message: v.message,
      };
    }),
  };
}

module.exports = { buildListView };
