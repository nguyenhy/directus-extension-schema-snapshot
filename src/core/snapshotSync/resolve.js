const fs = require('fs');
const { readEventLog, activeAddEvents, parseSyncMessage } = require('./eventLog');
const { contentHash } = require('../hash');
const { AmbiguousRefError, EventNotFoundError } = require('../errors');

function findEventById(log, eventId) {
  return activeAddEvents(log).find((e) => e.id === eventId);
}

function findEventByHashPrefix(log, hashPrefix) {
  const matches = activeAddEvents(log).filter((e) => e.hash.startsWith(hashPrefix));
  if (matches.length > 1) {
    throw new AmbiguousRefError(
      `Ambiguous hash prefix "${hashPrefix}" matches ${matches.length} events: ${matches.map((e) => e.id).join(', ')} — use a longer prefix`
    );
  }
  return matches[0];
}

/**
 * Finds `event`'s commit among `versions` by its `sync: eN (hash7)`
 * message (fast path — the format `core/operations/sync.js` writes).
 * @returns {{id: string, timestamp: string, message: string}|undefined}
 */
function findBySyncMessage(versions, event) {
  const hashPrefix = event.hash.slice(0, 7);
  return versions.find((v) => {
    const parsed = parseSyncMessage(v.message);
    return parsed.event === event.id && parsed.hash === hashPrefix;
  });
}

/**
 * Finds `event`'s commit among `versions` by recomputing each candidate's
 * tree content hash and comparing it to `event.hash` — fallback for
 * commits that were never written by `sync` (e.g. `add`'s own direct
 * commit, which has a plain user message, not the `sync: eN (hash)`
 * form). Without this, a version is unresolvable by its own event
 * id/hash from the moment it's added until the next `sync` runs, even
 * though the commit already exists locally. Newest-first order (as
 * `store.list()` returns) means the common case — resolving the version
 * you just added — hits on the first candidate checked.
 * @param {import('../store/store').Store} store
 * @param {{id: string, timestamp: string, message: string}[]} versions
 * @param {object} event
 * @returns {Promise<{id: string, timestamp: string, message: string}|undefined>}
 */
async function findByContentHash(store, versions, event) {
  for (const v of versions) {
    const tree = await store.get(v.id);
    if (contentHash(tree) === event.hash) return v;
  }
  return undefined;
}

/**
 * Resolves an event id ("e3") or content hash (prefix or full) from
 * `schema-snapshots/meta.json` to the local GitStore commit id that
 * represents it. This is the default id surface for `show`/`get`/`diff`
 * (see docs/cli-commands.md "Which id goes where") — a raw GitStore
 * commit sha (cache-ref) is a separate, explicit-opt-in path
 * (`--cache-ref`), never guessed here: a short content hash and a short
 * git sha are the same hex shape, so auto-detecting between them would be
 * ambiguous by construction.
 *
 * Two-tier lookup: tries the fast `sync`-message match first, then falls
 * back to a content-hash scan (see findByContentHash's doc comment for
 * why the fallback exists). Callers with several refs to resolve in one
 * command (`diff`, `extract`) should fetch `store.list()` once and pass
 * it as `versions` to avoid a redundant full git-log read per ref.
 * @param {string} ref - "e<N>" or a hex content-hash (prefix or full)
 * @param {{snapshotsDir: string, store: import('../store/store').Store, versions?: {id: string, timestamp: string, message: string}[]}} params
 * @returns {Promise<string>} GitStore commit id
 * @throws {Error} if `ref` doesn't match any active event, or no local
 *   commit matches it by message or content (fall back to `--cache-ref`
 *   with a raw commit sha)
 */
async function resolveRef(ref, { snapshotsDir, store, versions }) {
  const log = readEventLog(snapshotsDir);
  const isEventId = /^e\d+$/.test(ref);
  const event = isEventId ? findEventById(log, ref) : findEventByHashPrefix(log, ref);

  if (!event) {
    throw new EventNotFoundError(
      isEventId
        ? `No active event "${ref}" in schema-snapshots/meta.json`
        : `No active event with hash prefix "${ref}" in schema-snapshots/meta.json`
    );
  }

  const allVersions = versions || (await store.list());
  const commit = findBySyncMessage(allVersions, event) || (await findByContentHash(store, allVersions, event));

  if (!commit) {
    throw new EventNotFoundError(
      `Event "${event.id}" (${event.hash.slice(0, 7)}) not found in the local GitStore cache — run \`add\`/\`sync\` first, or pass --cache-ref with a raw commit sha`
    );
  }

  return commit.id;
}

/**
 * Resolves one `diff`/`extract`-style arg to whatever `store.get()` (or
 * `normalize`d parsing) ultimately needs: an existing file path is
 * returned as-is, `--cache-ref` returns the raw arg unresolved, otherwise
 * it's treated as an event id/hash and run through resolveRef(). Shared
 * by cmdDiff and cmdExtract — same file-vs-ref precedence, kept in one
 * place instead of copy-pasted per command.
 * @param {string} arg - a file path, event id ("e3"), or content hash
 * @param {{snapshotsDir: string, store: import('../store/store').Store, cacheRef?: boolean, versions?: {id: string, timestamp: string, message: string}[]}} params
 * @returns {Promise<string>} file path (unchanged) or resolved GitStore commit id
 */
async function resolveArgOrFile(arg, { snapshotsDir, store, cacheRef, versions }) {
  if (cacheRef || fs.existsSync(arg)) return arg;
  return resolveRef(arg, { snapshotsDir, store, versions });
}

module.exports = { resolveRef, resolveArgOrFile };
