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
 * @property {function(import('../normalizers').EntityTree, string=): Promise<{id: string, message: string, previousTree: import('../normalizers').EntityTree}>} set
 *   Commits a new version. previousTree is what was stored immediately
 *   before this call ({} for the very first version) — handed back so
 *   callers can compute a diff without a second read.
 *
 * @property {function(string, string): Promise<{result: import('../diff').DiffResult, treeOld: import('../normalizers').EntityTree, treeNew: import('../normalizers').EntityTree, idOld: string, idNew: string}>} diffVersions
 *   Diffs two committed versions. MUST auto-sort by time so
 *   diffVersions(a, b) === diffVersions(b, a) — always old→new in the
 *   result, regardless of argument order (GitStore sorts by commit time).
 */

module.exports = {};
