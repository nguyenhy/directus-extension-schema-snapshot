const { getNormalizer } = require('../normalizers');
const { diff } = require('../diff');
const { buildAddView } = require('../present/add');
const { contentHash } = require('../hash');
const { readEventLog, writeEventLog, appendAddEvent } = require('../snapshotSync/eventLog');

/**
 * Normalizes a schema file and commits it as a new version — the full
 * "add" operation, independent of CLI vs UI. Callers (cmdAdd, a UI
 * backend, etc.) just choose how to render the returned view.
 *
 * When `snapshotsDir` is given, also dual-writes to the host-repo-tracked
 * event log (`schema-snapshots/`, see docs/proposal-schema-snapshot-sync.md
 * §2) alongside the existing GitStore commit — GitStore stays the local
 * cache, `meta.json` becomes the sync-able identity. Omit `snapshotsDir`
 * to keep the old GitStore-only behavior (e.g. existing tests).
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

  const { id, message: committedMessage, previousTree } = await store.set(tree, message, raw);

  if (snapshotsDir) {
    const hash = contentHash(tree);
    const log = readEventLog(snapshotsDir);
    appendAddEvent(snapshotsDir, log, hash, raw);
    writeEventLog(snapshotsDir, log);
  }

  const result = diff(previousTree, tree);
  return buildAddView(id, committedMessage, result, previousTree, tree);
}

module.exports = { addVersion };
