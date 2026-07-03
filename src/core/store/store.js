/**
 * @typedef {Object} Store
 * Contract every version store implementation (git-backed, or a future
 * alternative) must satisfy — this is what core/operations/*.js depends
 * on, not any concrete class. GitStore (./git.js) is the reference
 * implementation; read its method docs for behavioral detail, this file
 * is the checklist a new implementation must match.
 *
 * @property {function(): Promise<{id: string, timestamp: string, message: string}[]>} list
 *   Returns all committed versions, newest first. Empty array if none exist.
 *
 * @property {function(string): Promise<import('../normalizers').EntityTree>} get
 *   Reads the full EntityTree for a given version id (id format is
 *   implementation-specific — GitStore uses commit SHA/prefix).
 *   Must throw if id doesn't resolve to a version in this store.
 *
 * @property {function(import('../normalizers').EntityTree, string=, object=): Promise<{id: string, message: string, previousTree: import('../normalizers').EntityTree}>} set
 *   Commits a new version. previousTree is what was stored immediately
 *   before this call ({} for the very first version) — handed back so
 *   callers can compute a diff without a second read. Optional third arg
 *   `raw` is the original, pre-normalize source — stored verbatim so
 *   getRaw() can return it later with no reconstruction step.
 *
 * @property {function(string): Promise<object>} getRaw
 *   Returns the raw source exactly as passed to set()'s `raw` argument
 *   for the given version id — no tree reconstruction, no denormalize,
 *   no merge (contrast with get(), which reassembles the EntityTree).
 *   Must throw a clean Error if no raw source was stored for this id
 *   (e.g. versions committed before this capability existed, or
 *   committed via set() with no `raw` argument).
 *
 * @property {function(string, string): Promise<{result: import('../diff').DiffResult, treeOld: import('../normalizers').EntityTree, treeNew: import('../normalizers').EntityTree, idOld: string, idNew: string}>} diffVersions
 *   Diffs two committed versions. MUST auto-sort by time so
 *   diffVersions(a, b) === diffVersions(b, a) — always old→new in the
 *   result, regardless of argument order (GitStore sorts by commit time).
 *
 * @property {function(): Promise<{id: string, revertedId: string, previousTree: import('../normalizers').EntityTree, tree: import('../normalizers').EntityTree}>} removeLatest
 *   Removes the most recent version. MUST be non-destructive — every
 *   prior version, including the one just "removed", MUST remain
 *   readable via get()/list() afterward (GitStore implements this as a
 *   revert commit, never history rewrite/deletion). Throws if the store
 *   has no versions yet.
 *
 * @property {function(): Promise<void>} reset
 *   Wipes ALL history in this store and leaves it empty but usable
 *   (get()/set() etc. work immediately after, no re-construction needed).
 *   Unlike every other method here, this IS destructive by design — it
 *   exists for `core/operations/sync.js`, which treats this store as a
 *   disposable, fully-rebuildable cache of `schema-snapshots/meta.json`
 *   (see docs/proposal-schema-snapshot-sync.md). Callers must only call
 *   this on a store they know is being rebuilt from another source of
 *   truth immediately after, never on a store that's the only copy of
 *   its data.
 */

module.exports = {};
