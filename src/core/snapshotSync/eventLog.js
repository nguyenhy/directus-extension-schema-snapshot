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
 * Every `add` event whose id is NOT referenced by any `remove` event's
 * `removes` field — the "current" set of snapshots (see proposal §2).
 * @param {{events: Array<object>}} log
 * @returns {object[]} active add events, in original log order
 */
function activeAddEvents(log) {
  const removedIds = new Set(log.events.filter((e) => e.type === 'remove').map((e) => e.removes));
  return log.events.filter((e) => e.type === 'add' && !removedIds.has(e.id));
}

/**
 * Appends an `add` event for `hash` and writes the raw source to
 * `source/<hash>.json` if not already present. Content-addressed: the
 * same hash is written once, re-adding it never overwrites the file (see
 * proposal §2, gap 3.6 — source/*.json is immutable once written).
 * @param {string} dir - schema-snapshots/ directory
 * @param {{events: Array<object>}} log - mutated in place (event pushed)
 * @param {string} hash - contentHash() of the normalized tree
 * @param {object} raw - original parsed source, written verbatim
 * @returns {object} the appended event
 */
function appendAddEvent(dir, log, hash, raw) {
  const sourceDir = path.join(dir, SOURCE_DIR);
  fs.mkdirSync(sourceDir, { recursive: true });
  const sourcePath = path.join(sourceDir, `${hash}.json`);
  if (!fs.existsSync(sourcePath)) {
    fs.writeFileSync(sourcePath, JSON.stringify(raw, null, 2));
  }
  const event = { id: nextEventId(log), type: 'add', hash, at: new Date().toISOString() };
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

// Matches the commit message core/operations/sync.js writes for each
// replayed event: "sync: e2 (94c6dc9)" — the only place a GitStore commit
// records which meta.json event/hash it came from. Shared by
// present/list.js (display) and resolve.js (resolving event id/hash ->
// commit id) so both stay in lockstep with sync.js's message format.
const SYNC_MESSAGE_RE = /^sync: (e\d+) \(([0-9a-f]{7,64})\)$/;

/**
 * @param {string} message - a GitStore commit message
 * @returns {{event: string, hash: string}} parsed event id + hash prefix,
 *   or {event: '-', hash: '-'} if the message isn't a sync commit
 */
function parseSyncMessage(message) {
  const m = SYNC_MESSAGE_RE.exec(message || '');
  return m ? { event: m[1], hash: m[2] } : { event: '-', hash: '-' };
}

module.exports = {
  META_FILE,
  SOURCE_DIR,
  readEventLog,
  writeEventLog,
  activeAddEvents,
  appendAddEvent,
  appendRemoveEvent,
  readSource,
  parseSyncMessage,
};
