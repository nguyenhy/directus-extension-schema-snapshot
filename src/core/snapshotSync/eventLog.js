const fs = require('fs');
const path = require('path');

// schema-snapshots/ layout (see docs/proposal-schema-snapshot-sync.md §2):
//   meta.json          <- this module's event log
//   source/<hash>.json <- content-addressed raw source, written by appendAddEvent
const META_FILE = 'meta.json';
const SOURCE_DIR = 'source';

/**
 * Reads the event log from `<dir>/meta.json`. Returns an empty log if the
 * file doesn't exist yet (first `add` in a fresh repo).
 * @param {string} dir - schema-snapshots/ directory
 * @returns {{events: Array<object>}}
 */
function readEventLog(dir) {
  const metaPath = path.join(dir, META_FILE);
  if (!fs.existsSync(metaPath)) return { events: [] };
  return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
}

/**
 * Writes the event log to `<dir>/meta.json`. Always overwrites — callers
 * pass back the full log (readEventLog() + push), never a partial one.
 * @param {string} dir - schema-snapshots/ directory
 * @param {{events: Array<object>}} log
 */
function writeEventLog(dir, log) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, META_FILE), JSON.stringify(log, null, 2));
}

function nextEventId(log) {
  return `e${log.events.length + 1}`;
}

/**
 * Every `add` event currently active — the set backing `list`,
 * `resolveRef`, and `sync`'s replay. A `remove` event's `removes` field
 * names the specific event it undoes (an `add`, or another `remove`,
 * chaining — see docs/architecture.md's "Schema-snapshots sync layer" for
 * the toggle-chain model). Walks each chain to its root `add` event and
 * flips that add's active state once per link — final state is chain
 * parity (odd length = inactive, even = active).
 * @param {{events: Array<object>}} log
 * @returns {object[]} active add events, in original log order
 */
function activeAddEvents(log) {
  const resolvesToAdd = new Map(); // any event id -> the add event id its chain ultimately toggles
  const isActive = new Map(); // add event id -> current toggled state

  for (const event of log.events) {
    if (event.type === 'add') {
      resolvesToAdd.set(event.id, event.id);
      isActive.set(event.id, true);
    } else if (event.type === 'remove') {
      const targetAddId = resolvesToAdd.get(event.removes);
      resolvesToAdd.set(event.id, targetAddId);
      if (targetAddId !== undefined) isActive.set(targetAddId, !isActive.get(targetAddId));
    }
  }

  return log.events.filter((e) => e.type === 'add' && isActive.get(e.id));
}

/**
 * Appends an `add` event for `hash` and writes the raw source to
 * `source/<hash>.json` if not already present. Content-addressed: the
 * same hash is written once, re-adding it never overwrites the file (see
 * proposal §2, gap 3.6 — source/*.json is immutable once written).
 *
 * `message` is the user's free-text annotation (`add -m`). It's stored
 * here, not in the GitStore commit message, because the commit message
 * is machine-parsed (SYNC_MESSAGE_RE below) to recover the durable
 * event/hash — there's no room in that exact-match string for free text
 * too. Omitted from the event entirely when not given, so old logs and
 * new ones without a message stay identical in shape.
 * @param {string} dir - schema-snapshots/ directory
 * @param {{events: Array<object>}} log - mutated in place (event pushed)
 * @param {{hash: string, raw: object, message?: string}} fields
 *   `hash` - contentHash() of the normalized tree
 *   `raw` - original parsed source, written verbatim
 *   `message` - user-supplied annotation for this version
 * @returns {object} the appended event
 */
function appendAddEvent(dir, log, { hash, raw, message }) {
  const sourceDir = path.join(dir, SOURCE_DIR);
  fs.mkdirSync(sourceDir, { recursive: true });
  const sourcePath = path.join(sourceDir, `${hash}.json`);
  if (!fs.existsSync(sourcePath)) {
    fs.writeFileSync(sourcePath, JSON.stringify(raw, null, 2));
  }
  const event = { id: nextEventId(log), type: 'add', hash, at: new Date().toISOString() };
  if (message) event.message = message;
  log.events.push(event);
  return event;
}

/**
 * Appends a `remove` (tombstone) event referencing an active `add` event —
 * never deletes `source/*.json`, never rewrites prior events (proposal
 * gap 3.6). Resolves by `eventId` when given (explicit escape hatch, gap
 * 3.4), otherwise by `hash` — the latest active add event matching it.
 * @param {{events: Array<object>}} log - mutated in place (event pushed)
 * @param {{hash?: string, eventId?: string}} target
 * @returns {object} the appended event
 * @throws {Error} if no active add event matches
 */
function appendRemoveEvent(log, { hash, eventId }) {
  const active = activeAddEvents(log);
  let resolved;
  if (eventId) {
    resolved = active.find((e) => e.id === eventId);
    if (!resolved) throw new Error(`No active add event with id "${eventId}"`);
  } else {
    const matches = active.filter((e) => e.hash === hash);
    if (matches.length === 0) throw new Error(`No active add event for hash "${hash}"`);
    resolved = matches[matches.length - 1];
  }
  const event = { id: nextEventId(log), type: 'remove', removes: resolved.id, at: new Date().toISOString() };
  log.events.push(event);
  return event;
}

/**
 * Appends a `remove` event referencing `targetId` directly — no
 * active-only lookup/validation, unlike `appendRemoveEvent`. Used by
 * `removeLatestVersion` (core/operations/remove.js), whose `targetId` is
 * read straight off GitStore's current HEAD, so it's already known-valid
 * and may be a `remove` event or a currently-inactive `add` — both of
 * which `appendRemoveEvent`'s active-only lookup would reject.
 * @param {{events: Array<object>}} log - mutated in place (event pushed)
 * @param {string} targetId - "e<N>" of the specific event being undone
 * @returns {object} the appended event
 */
function appendRemoveEventById(log, targetId) {
  const event = { id: nextEventId(log), type: 'remove', removes: targetId, at: new Date().toISOString() };
  log.events.push(event);
  return event;
}

/**
 * Reads the raw source for an active add event's hash from `source/`.
 * @param {string} dir - schema-snapshots/ directory
 * @param {string} hash
 * @returns {object}
 * @throws {Error} if the source file is missing
 */
function readSource(dir, hash) {
  const sourcePath = path.join(dir, SOURCE_DIR, `${hash}.json`);
  if (!fs.existsSync(sourcePath)) throw new Error(`No source file for hash "${hash}"`);
  return JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
}

// Matches the commit message format for a synced event: "sync: e2 (94c6dc9)"
// — the only shape a GitStore commit uses to record which meta.json
// event/hash it came from. Written by both core/operations/add.js (at
// commit time, when snapshotsDir is given) and core/operations/sync.js
// (on replay) via formatSyncMessage() below, so the two can never drift.
// Read by present/list.js (display) and resolve.js (resolving event
// id/hash -> commit id).
const SYNC_MESSAGE_RE = /^sync: (e\d+) \(([0-9a-f]{7,64})\)$/;

/**
 * @param {string} eventId - "e<N>"
 * @param {string} hash - full contentHash() hex string
 * @returns {string} "sync: e2 (94c6dc9)" — hash truncated to 7 chars
 */
function formatSyncMessage(eventId, hash) {
  return `sync: ${eventId} (${hash.slice(0, 7)})`;
}

/**
 * @param {string} message - a GitStore commit message
 * @returns {{event: string, hash: string}} parsed event id + hash prefix,
 *   or {event: '-', hash: '-'} if the message isn't a sync commit
 */
function parseSyncMessage(message) {
  const m = SYNC_MESSAGE_RE.exec(message || '');
  return m ? { event: m[1], hash: m[2] } : { event: '-', hash: '-' };
}

// Matches the commit message GitStore.removeLatest() writes when a
// `remove --latest` tombstones a meta.json event (see
// core/operations/remove.js's removeLatestVersion): "remove: e2 (removes
// e1)". Deliberately distinct from SYNC_MESSAGE_RE — a remove event has
// no content hash (it deletes, it doesn't add a tree), so it's not a
// resolvable version id the way an add event's is. present/list.js uses
// this to label the row informationally without implying it's usable
// with --id/show/get/diff.
const REMOVE_MESSAGE_RE = /^remove: (e\d+) \(removes (e\d+)\)$/;

/**
 * @param {string} eventId - "e<N>" of the new tombstone event
 * @param {string} removedEventId - "e<N>" of the specific event it undoes
 *   (an `add` event, or another `remove` event — see activeAddEvents)
 * @returns {string} "remove: e2 (removes e1)"
 */
function formatRemoveMessage(eventId, removedEventId) {
  return `remove: ${eventId} (removes ${removedEventId})`;
}

/**
 * @param {string} message - a GitStore commit message
 * @returns {{event: string, removes: string}|null} parsed tombstone event
 *   id + the specific event id it undoes, or null if not a remove commit
 */
function parseRemoveMessage(message) {
  const m = REMOVE_MESSAGE_RE.exec(message || '');
  return m ? { event: m[1], removes: m[2] } : null;
}

module.exports = {
  META_FILE,
  SOURCE_DIR,
  readEventLog,
  writeEventLog,
  activeAddEvents,
  appendAddEvent,
  appendRemoveEvent,
  appendRemoveEventById,
  readSource,
  nextEventId,
  formatSyncMessage,
  parseSyncMessage,
  formatRemoveMessage,
  parseRemoveMessage,
};
