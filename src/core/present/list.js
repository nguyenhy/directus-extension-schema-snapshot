const { parseSyncMessage, parseRemoveMessage } = require('../snapshotSync/eventLog');

/**
 * Builds a render-agnostic view of the version list, one row per
 * `schema-snapshots/meta.json` event: `event` (its own id), `action`
 * (what it did), `timestamp`. This mirrors meta.json directly rather than
 * inferring identity from commit-message shape — every row's `action` is
 * one of:
 *   - `add <hash7>` — an `add` event (commit stamped `sync: eN (hash)`,
 *     see eventLog.js's formatSyncMessage).
 *   - `undo <targetEventId>` — a `remove` event (commit stamped
 *     `remove: eN (removes eM)`, see formatRemoveMessage). `targetEventId`
 *     is the SPECIFIC event this one undoes — an `add` event, or another
 *     `remove` event (undoing that undo) — never resolved through to some
 *     deeper original (see eventLog.js's activeAddEvents doc comment for
 *     how a chain of these resolves to a final active/inactive state).
 *   - `-` — a commit not produced by `add`/`sync`/`remove --latest`'s
 *     stamping (e.g. `add` before dual-write existed, or a custom `-m`
 *     message with no `--snapshots-dir`). No durable identity exists for
 *     these; `event` is also "-".
 * Two distinct timestamps are surfaced explicitly rather than one implicit
 * `timestamp`, since they can diverge and mean different things:
 *   - `commitTimestamp` — when this GitStore commit was made. Disposable:
 *     `sync` rebuilds `.snapshot/repo` from scratch, so a replayed commit
 *     gets a new commit time even though it represents an old event.
 *   - `eventTimestamp` — `schema-snapshots/meta.json`'s own `event.at`,
 *     set once when the event was first appended and never rewritten.
 *     '-' when this commit has no matching event (see `event`/`action`
 *     above for when that happens).
 * @param {{id: string, timestamp: string, message: string}[]} versions - newest first
 * @param {Object.<string, string>} [eventAtById] - event id -> event.at,
 *   from schema-snapshots/meta.json (see core/operations/list.js)
 * @returns {{count: number, versions: {id: string, shortId: string, event: string, action: string, commitTimestamp: string, eventTimestamp: string, message: string}[]}}
 */
function buildListView(versions, eventAtById = {}) {
  return {
    count: versions.length,
    versions: versions.map((v) => {
      const syncMatch = parseSyncMessage(v.message);
      const removeMatch = parseRemoveMessage(v.message);
      let event = '-';
      let action = '-';
      if (syncMatch.event !== '-') {
        event = syncMatch.event;
        action = `add ${syncMatch.hash}`;
      } else if (removeMatch) {
        event = removeMatch.event;
        action = `undo ${removeMatch.removes}`;
      }
      const eventAt = eventAtById[event];
      return {
        id: v.id,
        shortId: v.id.slice(0, 7),
        event,
        action,
        commitTimestamp: new Date(v.timestamp).toISOString().replace('T', ' ').slice(0, 19),
        eventTimestamp: eventAt ? new Date(eventAt).toISOString().replace('T', ' ').slice(0, 19) : '-',
        message: v.message,
      };
    }),
  };
}

module.exports = { buildListView };
