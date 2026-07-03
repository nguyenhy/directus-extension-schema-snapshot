const { getNormalizer } = require('../normalizers');
const { diff } = require('../diff');
const { buildAddView } = require('../present/add');
const { contentHash } = require('../hash');
const { readEventLog, writeEventLog, appendAddEvent, formatSyncMessage } = require('../snapshotSync/eventLog');

/**
 * Normalizes a schema file and commits it as a new version — the full
 * "add" operation, independent of CLI vs UI. Callers (cmdAdd, a UI
 * backend, etc.) just choose how to render the returned view.
 *
 * When `snapshotsDir` is given, also dual-writes to the host-repo-tracked
 * event log (`schema-snapshots/`, see docs/proposal-schema-snapshot-sync.md
 * §2) — GitStore stays the local cache, `meta.json` becomes the sync-able
 * identity. The event id/hash are minted BEFORE the commit and the commit
 * message is stamped with them (same `sync: eN (hash)` format `sync`
 * writes on replay), so `list`/`resolve.js` see the durable identity the
 * instant `add` returns — no separate `sync` run required to make a
 * freshly added version resolvable. `message`, when given alongside
 * `snapshotsDir`, is stored on the event in `meta.json` instead of the
 * commit (see appendAddEvent's doc comment for why); the commit itself
 * always gets the stamped form so parsing stays unambiguous. Omit
 * `snapshotsDir` to keep the old GitStore-only behavior (e.g. existing
 * tests): no durable id exists in that mode, so `message` goes straight
 * into the commit as before.
 * @param {{inputPath: string, schemaType: string, message?: string, store: import('../store/store').Store, parse: (filePath: string) => object, snapshotsDir?: string}} params
 *   `store` and `parse` are required — injected dependencies from
 *   core/env.js, never constructed here. See core/operations/show.js for
 *   the store rationale; `parse` follows the same reasoning so a non-json
 *   file format never requires touching this file.
 * @returns {Promise<ReturnType<typeof buildAddView>>}
 */
async function addVersion({ inputPath, schemaType, message, store, parse, snapshotsDir }) {
  const { normalize } = getNormalizer(schemaType);
  const raw = parse(inputPath);
  const tree = normalize(raw);

  let commitMessage = message;
  let log, event;
  if (snapshotsDir) {
    const hash = contentHash(tree);
    log = readEventLog(snapshotsDir);
    event = appendAddEvent(snapshotsDir, log, hash, raw, message); // mints the event id, stores message on the event, writes source/<hash>.json now
    commitMessage = formatSyncMessage(event.id, hash);
  }

  const { id, message: committedMessage, previousTree } = await store.set(tree, commitMessage, raw);

  if (snapshotsDir) {
    writeEventLog(snapshotsDir, log); // persist meta.json only after the stamped commit succeeds
  }

  const result = diff(previousTree, tree);
  return buildAddView(id, committedMessage, result, previousTree, tree);
}

module.exports = { addVersion };
