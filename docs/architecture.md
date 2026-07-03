# Architecture

Status: `normalize`, `diff`, `add`, `list`, `show`, `get`, `remove`, `extract`, `sync`, `status` all implemented. Storage is **dual**: `.snapshot/repo` (git-backed `GitStore`, local-only, disposable/rebuildable cache) plus `schema-snapshots/` (host-repo-tracked event log + content-addressed source — the sync-able source of truth, see "Schema-snapshots sync layer" below). See [roadmap-draft.md](./roadmap-draft.md) for what's still ahead (rename detection, migrate-plan/apply, Web UI, auto/manual sync toggle).

## Directory structure

```
src/
  core/                     Feature logic. Pure/IO-injected, no CLI dependency — reusable by
                             any future caller (CLI today, a UI/API later).

    diff.js                   diff(treeOld, treeNew) -> DiffResult
                               Generic tree-diff. No Directus knowledge, no I/O.

    hash.js                    contentHash(value) -> sha256 hex. Deterministic, sorted-key
                               JSON hash — the public, cross-device snapshot identity (see
                               "Schema-snapshots sync layer" below).

    snapshotSync/
      eventLog.js               readEventLog/writeEventLog/appendAddEvent/appendRemoveEvent/
                               activeAddEvents/readSource/parseSyncMessage — schema-snapshots/
                               meta.json + source/ read-write, and the fold-to-active-set logic.
      resolve.js                resolveRef/resolveArgOrFile — event id ("e3") or content hash ->
                               local GitStore commit id, via meta.json + sync-produced commit
                               messages. The only place that translation happens.

    directus/
      normalize.js             normalize(rawSchema) -> EntityTree
                               Directus-specific: reads collections/fields/relations, strips
                               volatile keys (id, date_created, ...), sorts object keys.

    normalizers/
      index.js                 getNormalizer(type) -> Normalizer   — registry + lookup.

    parsers/
      index.js                 getParser(format) -> Parser         — registry + lookup.

    store/
      store.js                  Store contract (JSDoc typedef only, no code) — the interface
                                every store impl must satisfy.
      git.js                    GitStore — reference (and only) implementation. Every
                                version = one commit of the full tree.

    operations/                One file per command's actual logic (normalize/diff/add/list/
                                show/get/remove/extract/sync/status). Pure orchestration: call
                                normalizer/parser/store, build a view via present/, return it.
                                No console.log, no process.exit, no commander. Reusable by a
                                UI backend.
      extract.js               Extracts a partial EntityTree of added, removed, or modified entities.
                                Also exports mergeIntoOld() (reconstructs a full tree for
                                --snapshot/--snapshot-file) and verifyMerge() (re-diffs the
                                reconstruction to confirm it matches the extracted mode's keys).
      sync.js                   syncSnapshots() — wipes .snapshot/repo and rebuilds it from
                                schema-snapshots/meta.json's active events, every call (not
                                incremental). readSyncState/writeSyncState manage
                                .snapshot/sync-state.json ({syncedHash} only).
      status.js                 statusView() — read-only meta.json-hash vs sync-state.json
                                comparison.

    present/                    One file per command's view-builder: turns operation output
                                into a plain, render-agnostic object (JSON-serializable,
                                CLI/UI-neutral). No string formatting/printing here.
      extract.js               Extract operation view builder.

    env.js                     createEnv({storeDir, storeType, fileFormat}) -> {store, parse}
                               Composition root — the ONLY place a concrete Store/Parser is
                               constructed. See "Pluggability" below.

  cli/                       Everything specific to the command-line interface.
    index.js                   commander setup: registers subcommands, wires flags, entrypoint.
    commands/                  One file per command: commander action handler. Thin glue —
                                calls createEnv() + the matching core/operations/*.js function,
                                then either JSON.stringify (--json) or hands off to render/.
      extract.js               Action handler for extract command.
    render/                     One file per command: printAddView/printDiffView/etc. —
                                console.log formatting of a present/ view. Only place that
                                touches stdout.
      extract.js               CLI printer for extract command.

  utils/                     Small, generic, feature-agnostic helpers — no schema/business
                              knowledge.
    parseJson.js                parseJSONFile(path) -> object, clean errors on missing/bad file.
    fsTree.js                   writeTreeToDir()/readTreeFromDir() (EntityTree <-> "kind/name.json"
                                files) + runSubDir() (templated, collision-safe subdir naming).
    timestamp.js                timestamp() — YYYYMMDD-HHmmss formatter.

  config.js                  Reads .env / process.env into one exported config object (CLI
                              flag defaults). The only file that touches process.env directly.

fixtures/                   Sample schema JSON pairs used for manual/smoke testing (v1.json, v2.json).
docs/                       Design docs — this file, CLI reference, roadmap.
test/                       node:test suite (git-store.test.js, store.contract.js — the latter
                             is a reusable contract test any future Store impl must pass).
```

**Rule of thumb for where new code goes:**
- Knows what a "collection/field/relation" is, or talks to git/disk for persistence? → `core/`.
- One command's pure workflow (call normalizer → call store → build view)? → `core/operations/<command>.js`.
- Turning that workflow's output into a flat, renderable object? → `core/present/<command>.js`.
- Only makes sense from a terminal (flags, stdout, prompts)? → `cli/commands/` (parse args, call operation) + `cli/render/` (print the view).
- Generic enough for an unrelated project (timestamp formatting, generic file I/O)? → `utils/`.

## Flow

Every command follows the same 4-layer pipeline. Concrete example, `add`:

```
cli/index.js (commander registers "add", parses argv)
  -> cli/commands/add.js: cmdAdd(inputPath, options)
       1. createEnv({storeDir, storeType, fileFormat})   // core/env.js — builds {store, parse}
       2. core/operations/add.js: addVersion({inputPath, schemaType, message, store, parse})
            a. parse(inputPath)                           // core/parsers -> raw JSON object
            b. getNormalizer(schemaType).normalize(raw)    // core/directus/normalize.js -> EntityTree
            c. store.set(tree, message)                    // core/store/git.js -> commits, returns {id, previousTree}
            d. diff(previousTree, tree)                     // core/diff.js -> DiffResult
            e. buildAddView(id, message, result, ...)       // core/present/add.js -> plain view object
       3. options.json ? JSON.stringify(view) : printAddView(view)   // cli/render/add.js -> stdout
```

Every other command (`diff`, `list`, `show`, `remove`, `normalize`, `extract`) is the same shape: **cli/commands (parse argv, build env)** → **core/operations (orchestrate: parser/normalizer/store/diff)** → **core/present (build plain view)** → **cli/render (print) or raw JSON (--json)**.

Note that `extract` follows the same 4-layer shape as `diff` (with file-vs-version auto-detect). However, `extract` restricts the argument combinations for `<old>` and `<new>` to exactly three supported combinations: `file` + `file`, `hash` (version ID) + `file`, and `hash` + `hash`. Any combination of `file` + `hash` (where `<old>` is a file path and `<new>` is a version ID) is rejected and throws an error.

When `--snapshot`/`--snapshot-file` is passed, `extractSchemas()` additionally calls `mergeIntoOld(treeOld, deltaTree, mode)` to reconstruct a full, applyable schema (rather than the partial delta), then `verifyMerge(treeOld, merged, result, mode)` to re-diff `treeOld` against the reconstruction and confirm it changed exactly the extracted mode's key set — see "Snapshot reconstruction & merge verification" below.

Why this split: `core/operations/*.js` never imports commander, console, or process — a future Web UI backend calls the exact same functions and gets the exact same view objects, only swapping the last hop (HTTP response instead of stdout print).

## Data structures (pluggable points)

### EntityTree — the shape every operation passes around

`{"kind:name": entity, ...}` — a flat map, not a nested tree despite the name. Produced by any `Normalizer.normalize()`, consumed by `diff()`, `Store.set()`, and every `present/*.js`. Key format is `"kind:name"` (e.g. `"field:orders.status"`, `"collection:orders"`, `"relation:orders.customer"`) — defined once in `core/directus/normalize.js`'s `entityKey()`, referenced everywhere else as a de facto wire format (string-split, not parsed via a shared helper — changing the format silently breaks `fsTree.js` and `buildMeta()` without a compile error).

### Normalizer — pluggable input schema type

```js
{ normalize(rawSchema) -> EntityTree }
```
Registry: `core/normalizers/index.js`, keyed by `--schema-type` (default `directus`, env `SCHEMA_SNAPSHOT_TYPE`). Only `directus` registered today. **To add one**: write a module exporting `normalize(rawSchema) -> EntityTree` with the same key format, add one entry to the `normalizers` map. No other file changes — `diff.js`, `fsTree.js`, CLI commands never see raw input, only the resulting tree.

### Parser — pluggable input file format

```js
{ parse(filePath) -> object }
```
Registry: `core/parsers/index.js`, keyed by `--file-format` (default `json`). Only `json` registered today (`utils/parseJson.js`). **To add one** (e.g. yaml): write `utils/parseYaml.js`, register it. Same shape as the Normalizer registry, deliberately.

### Store — pluggable version-persistence backend

Contract lives in `core/store/store.js` (JSDoc-only checklist, no code) — `list()`, `get(id)`, `getRaw(id)`, `set(tree, message?, raw?)`, `diffVersions(idA, idB)`, `removeLatest()`. `GitStore` (`core/store/git.js`) is the only implementation: every version is a full git commit of the tree (not a delta — reads are direct `git show`/`ls-tree`, never a replay chain). `removeLatest()` is a `git revert`, never destructive — every prior version stays readable via `get()`/`list()` afterward. **To add a backend** (e.g. sqlite): implement the `Store` contract, register it in `core/env.js`'s `createStore()` switch, and it must pass `test/store.contract.js`. No `core/operations/*.js` file changes — they only depend on the `Store` interface, injected via `createEnv()`.

`set()` optionally commits the raw, pre-normalize source alongside the normalized tree, as a fixed filename `_source.json` (`GitStore.RAW_SOURCE_FILE` in `git.js`) in the same commit. `getRaw(id)` reads it back with a direct `git show <id>:_source.json` — no reconstruction. `core/operations/get.js`'s `getRawSourceView()` (used by the `get` CLI command) is the only caller; it throws if a version was committed with no raw source (e.g. versions committed before this capability existed). This is distinct from `get(id)`, which returns the normalized `EntityTree`, and from `extract --snapshot`'s `mergeIntoOld()`, which reconstructs a tree by overlaying a delta — `getRaw()` does no reconstruction at all, it's a verbatim byte-for-byte read of what `add` originally received.

### DiffResult — the shape diff() produces

```js
{ added: string[], removed: string[], modified: {key: string, changes: {path, from, to}[]}[] }
```

Documented as `@typedef {object} DiffResult` in [core/diff.js](../src/core/diff.js#L44-L49).

Produced by `core/diff.js`'s `diff(treeOld, treeNew)` — generic, no Directus knowledge. It is also consumed by the `extract` operation (`core/operations/extract.js`) to filter the EntityTree down to the matching set of keys depending on the chosen mode, and reused a second time inside `verifyMerge()` to re-diff `treeOld` against a reconstructed snapshot. Equality is `JSON.stringify` comparison (relies on `stripVolatile()` sorting object keys first — NOT a structural equality check). `changedPaths()` only recurses into plain objects; arrays are compared as whole values (one changed array element reports the entire array as changed, not a per-element diff). No rename detection — a remove + add is always two entries, never inferred as one rename (see [roadmap-draft.md](./roadmap-draft.md) stage 2).

## Composition root: core/env.js

`createEnv({storeDir, storeType, fileFormat}) -> {store, parse}` is the **only** place a concrete `Store` or `Parser` is constructed (`new GitStore(...)` appears nowhere else). Every `cli/commands/*.js` calls it once, then passes `{store, parse}` into the matching `core/operations/*.js` function as injected dependencies. A future UI backend does the same — construct env once, call the same operation functions.

## Subdir format (normalize & extract)

Every non-dry-run `normalize` and `extract` command writes into a fresh subdir of `--out-dir`, named from a template so repeated runs never collide. Controlled by `--subdir-format` (default `{time}_{name}`), overridable via `SCHEMA_SNAPSHOT_SUBDIR_FORMAT`.

- **Placeholders**: 
  - `{time}` — `YYYYMMDD-HHmmss`.
  - `{name}` — For `normalize`, the basename of the input file (no extension). For `extract`, computed from the concatenated string `<old>_<new>`.
- **GOTCHA (for `extract`)**: Because `runSubDir` uses `path.basename` on the combined `<old>_<new>` input string to compute the `{name}` placeholder, if the `<new>` argument is an absolute or relative file path containing `/` separators, any text before the last `/` (which includes the entire `<old>` argument) will be silently stripped out of `{name}` (e.g. `20f5c7f_/path/to/new.json` resolves to a `{name}` of `new`).
- **Default `{time}_{name}`**: time-first so sorted output reads chronologically across all inputs.
- **Validation** (`utils/fsTree.js`'s `runSubDir()`), fails fast before any write: must use `{name}` and/or `{time}`; unknown placeholders rejected; rendered result can't contain an empty, `.`, or `..` segment (prevents escaping `--out-dir`).

## Extract dry-run behavior (default dry-run)

By default, `schema-snapshot extract` runs in **dry-run** mode (unlike `normalize` which writes by default). It prints the list of matching keys, the mode, and the subdirectory path where it *would* write.

Passing `--no-dry-run` writes the extracted entities to disk. It reuses `utils/fsTree.js`'s `runSubDir()` and `writeTreeToDir()` to output the exact same directory layout as `normalize` (e.g. `<out-dir>/<subdir>/<kind>/<name>.json`), making the output directly round-trip-able through `schema-snapshot add` or `show --json`.

## Snapshot reconstruction & merge verification (`--snapshot`/`--snapshot-file`)

`--snapshot`/`--snapshot-file` produce a single **full** schema file instead of one-file-per-entity, so it can be applied wholesale (e.g. re-imported into Directus) rather than requiring the caller to reassemble the split files. Requires the normalizer to expose `denormalize(tree) -> rawSchema`; only `directus` supports this today.

- `mergeIntoOld(treeOld, deltaTree, mode)` (`core/operations/extract.js`) does the reconstruction: `added`/`modified` overlay the delta onto `treeOld` (`{...treeOld, ...deltaTree}`); `removed` deletes the delta's keys from a copy of `treeOld`.
- `verifyMerge(treeOld, merged, result, mode)` re-diffs `treeOld` vs. the reconstruction and asserts the change set matches exactly the extracted mode's key set — no extra file I/O or network call, purely re-using data already in memory. Its result (`{ok, unexpectedAdded, unexpectedRemoved, unexpectedModified, missingKeys}`) is attached to `extractSchemas()`'s return value whenever a merge happened, surfaced by `cli/render/extract.js` as a `✓`/`✗` line and included in `--json` output.
- **GOTCHA**: `verifyMerge`'s unexpected-key logic assumes extraction is single-mode — for the two non-matching categories, the entire diff result for that category counts as "unexpected," not just entries outside the expected set. This holds today because `expectedKeys` is always empty for non-matching categories; if mixed-mode merges are ever supported, `verifyMerge` needs updating (see its doc comment).
- **Failure consequence**: dry-run prints the `✗` line but leaves the exit code untouched (nothing was written). A real (`--no-dry-run`) write writes the file first, then throws if verification fails — caught by `cli/index.js`'s central handler, printed as `Error: ...`, exit code `1`. The bad file stays on disk for inspection; nothing is auto-deleted (consistent with this repo's "non-destructive by construction" ethos — the file, once written, is never silently removed).

## Schema-snapshots sync layer

Full rationale/history: [proposal-schema-snapshot-sync.md](./proposal-schema-snapshot-sync.md) (§2 for the design, §5 for where the shipped code diverges from the original plan).

- **`.snapshot/repo`** (`GitStore`) — local-only, gitignored, disposable. Never synced across devices directly. Only used internally for `diffVersions()`/`get()`/`getRaw()` reads and `remove --latest`'s revert.
- **`schema-snapshots/`** — host-repo-tracked (committed by the project's own git, not gitignored): `meta.json` (append-only event log: `add`/`remove` events with `id`s, `remove` events reference an `add` event's `id` via `removes`, never a hash) + `source/<contentHash>.json` (raw source, content-addressed, immutable once written). This is the sync-able source of truth.
- **`add`** dual-writes both: commits to `.snapshot/repo` directly (as before this layer existed) *and*, when `--snapshots-dir` is set (default: on), appends an event + source file to `schema-snapshots/`.
- **`sync`** rebuilds `.snapshot/repo` from `schema-snapshots/meta.json`, unconditionally wiping the store dir first (`core/operations/sync.js`'s `wipeStore()`) and replaying every active `add` event as a fresh commit, message `sync: <eventId> (<hash7>)`. Not incremental — every call is a full teardown/rebuild, chosen after an incremental first attempt double-committed events `add` had already written directly (see proposal §5.1).
- **Resolution** (`core/snapshotSync/resolve.js`'s `resolveRef`): `show`/`get`/`diff`/`extract` accept an event id or content hash by default; resolution parses `sync`-produced commit messages (`parseSyncMessage()` in `eventLog.js`) to find the matching `.snapshot/repo` commit. This only works for events already `sync`ed — a fresh `add` isn't resolvable by its own hash until `sync` runs, since `add`'s own direct commit message isn't in `sync: eN (hash)` form.
- **`--cache-ref`**: explicit opt-in on `show`/`get`/`diff`/`extract` to bypass resolution and use a raw `.snapshot/repo` commit sha directly — never auto-detected (a short content hash and a short git sha are the same hex shape).
- **`status`**: read-only, compares `contentHash(meta.json)` against `.snapshot/sync-state.json`'s `syncedHash` (written by the last `sync`).

## Configuration

Copy `.env.example` to `.env` to override defaults. All vars optional; explicit CLI flags always win.

| Var | Default | Affects |
|---|---|---|
| `SCHEMA_SNAPSHOT_OUT_DIR` | `.snapshot/normalized` | `normalize`/`extract`'s default `--out-dir` |
| `SCHEMA_SNAPSHOT_TYPE` | `directus` | `normalize`/`diff`/`add`/`remove`/`extract`'s default `--schema-type` |
| `SCHEMA_SNAPSHOT_SUBDIR_FORMAT` | `{time}_{name}` | `normalize`/`extract`'s default `--subdir-format` |
| `SCHEMA_SNAPSHOT_STORE_DIR` | `.snapshot/repo` | `diff`/`add`/`list`/`show`/`remove`/`extract`/`sync`/`status`'s default `--store-dir` |
| `SCHEMA_SNAPSHOT_STORE_TYPE` | `git` | default `--store-type` (only `git` registered) |
| `SCHEMA_SNAPSHOT_FILE_FORMAT` | `json` | default `--file-format` (only `json` registered) |
| `SCHEMA_SNAPSHOT_SNAPSHOTS_DIR` | `schema-snapshots` | `add`/`show`/`get`/`diff`/`extract`/`remove`/`sync`/`status`'s default `--snapshots-dir` (see "Schema-snapshots sync layer") |

Loaded once at CLI startup via `src/config.js` (`dotenv`).

## Errors

Missing file, unsupported extension, malformed JSON, unknown `--schema-type`/`--file-format`/`--store-type`, unresolvable version id — all print a clean `Error: ...` message and exit 1 (caught centrally in `cli/index.js`), never a raw stack trace.

## Design rule

CLI-first, UI-ready. Every feature lands as `core/operations/*.js` + `core/present/*.js` (lib) before `cli/commands/*.js` + `cli/render/*.js` (thin CLI glue) — the lib/CLI boundary is what makes a future Web UI additive instead of a rewrite.
