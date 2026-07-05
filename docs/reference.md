# Reference

**Read first:** [README.md](../README.md) (what tool is) → [architecture.md](./architecture.md) (flow/structure) → this file.

**This file resolves:** why non-obvious things are the way they are, and traps invisible from reading one file alone. It is not a method/shape catalog — code + JSDoc already own that, and duplicating it here just rots on the next rename.

**Per-section convention** — every term below states, in order:

1. **What** — one-line definition.
2. **Where** — file it's defined/implemented in.
3. **Why** — design rationale (omitted if truly obvious).
4. **Gotcha** — trap invisible from reading that one file alone (omitted if none).

## EntityTree key format

### What

flat map `{"kind:name": entity, ...}` — the shape every operation passes around.

### Where

`core/directus/normalize.js`'s `entityKey()`.

### Why

flat + string-keyed so any two versions are diffable by plain key comparison, no tree-walk needed.

### Gotcha

the key is string-split, not parsed via a shared helper — `fsTree.js` and `buildMeta()` both do their own `.split(':')`. Changing the format breaks them silently, no compile error.

## Diff semantics traps

### What

`DiffResult` — typedef at [core/diff.js](../src/core/diff.js#L44-L49).

### Where

`diff(treeOld, treeNew)` in `core/diff.js`; reused by `extract` (filters by mode) and `verifyMerge()` (re-diffs a reconstruction).

### Why

no rename detection by design yet — a rename always shows as remove+add (see [roadmap-draft.md](./roadmap-draft.md) stage 2).

### Gotcha

equality is `JSON.stringify` comparison (relies on `stripVolatile()` sorting keys first), not structural equality — and `changedPaths()` only recurses plain objects, so one changed array element reports the whole array as changed.

## Store: why GitStore's shape is what it is

### What

`Store` — pluggable persistence contract; `GitStore` is the only implementation.

### Where

contract in `core/store/store.js` (JSDoc-only); implementation in `core/store/git.js`.

### Why

every version is a full git commit, not a delta — trades some storage size for "reads are always a direct `git show`, never a replay chain" (simpler, harder to get wrong). `removeLatest()` is a `git revert`, not a destructive op, to preserve the "every prior version stays readable" invariant.

### Gotcha

the raw pre-normalize source (`_source.json`) is stored separately from the normalized tree — `getRaw(id)` is a byte-exact read of it, while `get(id)` returns the normalized tree and `mergeIntoOld()` returns a _reconstruction_. Three different things that can look interchangeable but aren't.

## Extract & subdir gotchas

### What

`--subdir-format` controls the output folder name for `normalize`/`extract`; `extract` defaults to dry-run (unlike `normalize`, which writes by default).

### Where

`utils/fsTree.js`'s `runSubDir()`.

### Why

dry-run-by-default on `extract` because it's typically run to inspect a diff before committing to writing files.

### Gotcha

`extract`'s `{name}` placeholder is `path.basename` of the combined `<old>_<new>` string — if `<new>` is a path containing `/`, everything before the last `/` (including all of `<old>`) is silently stripped.

## Snapshot merge verification

### What

`--snapshot`/`--snapshot-file` reconstruct one full schema file (not one-file-per-entity) via `mergeIntoOld()`, then `verifyMerge()` re-diffs it to confirm the reconstruction changed exactly the extracted keys.

### Where

`core/operations/extract.js`.

### Why

exists so a caller can trust a reconstructed full-schema file wasn't silently corrupted by the overlay — verification is free (in-memory re-diff, no extra I/O), so it always runs.

### Gotcha

`verifyMerge`'s unexpected-key logic assumes single-mode extraction — for non-matching categories, the _entire_ diff result counts as unexpected, not just entries outside the expected set. On failure, a real write still leaves the bad file on disk (nothing auto-deleted); only the exit code (1) signals it.

## Sync layer — why two storage locations

### What

`.snapshot/repo` (local `GitStore`, disposable) vs. `schema-snapshots/` (host-repo-tracked `meta.json` event log + content-addressed source).

### Where

`core/snapshotSync/eventLog.js`, `core/operations/sync.js`. Full rationale/history: [proposal-schema-snapshot-sync.md](./proposal-schema-snapshot-sync.md).

### Why

`.snapshot/repo` is a rebuildable cache (git-backed for cheap diffing); `schema-snapshots/` is the actual portable, committed source of truth that survives a fresh clone.

### Gotcha

`remove` events form an undo chain (a `remove` can target another `remove`, making `remove --latest` safely repeatable — chain-length parity decides active/inactive). `sync`'s replay only works because `remove --latest` always targets HEAD; `remove --hash`/`--id` targeting a non-newest event can't be replayed the same way — `sync` detects the mismatch and throws rather than rebuilding wrong history.

## Configuration

Copy `.env.example` to `.env` to override defaults. All vars optional; explicit CLI flags always win.

- `SCHEMA_SNAPSHOT_OUT_DIR` (default `.snapshot/normalized`) — `normalize`/`extract`'s default `--out-dir`
- `SCHEMA_SNAPSHOT_TYPE` (default `directus`) — `normalize`/`diff`/`add`/`remove`/`extract`'s default `--schema-type`
- `SCHEMA_SNAPSHOT_SUBDIR_FORMAT` (default `{time}_{name}`) — `normalize`/`extract`'s default `--subdir-format`
- `SCHEMA_SNAPSHOT_STORE_DIR` (default `.snapshot/repo`) — `diff`/`add`/`list`/`show`/`remove`/`extract`/`sync`/`status`'s default `--store-dir`
- `SCHEMA_SNAPSHOT_STORE_TYPE` (default `git`) — default `--store-type` (only `git` registered)
- `SCHEMA_SNAPSHOT_FILE_FORMAT` (default `json`) — default `--file-format` (only `json` registered)
- `SCHEMA_SNAPSHOT_SNAPSHOTS_DIR` (default `schema-snapshots`) — `add`/`show`/`get`/`diff`/`extract`/`remove`/`sync`/`status`'s default `--snapshots-dir`

Loaded once at CLI startup via `src/config.js` (`dotenv`).

## Errors

Missing file, unsupported extension, malformed JSON, unknown `--schema-type`/`--file-format`/`--store-type`, unresolvable version id — all print a clean `Error: ...` message and exit 1 (caught centrally in `cli/index.js`), never a raw stack trace.
