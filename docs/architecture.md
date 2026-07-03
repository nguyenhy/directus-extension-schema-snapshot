# Architecture

Status: `normalize`, `diff`, `add`, `list`, `show`, `remove` all implemented. Storage is git-backed (`GitStore`). See [roadmap-draft.md](./roadmap-draft.md) for what's still ahead (rename detection, migrate-plan/apply, Web UI).

## Directory structure

```
src/
  core/                     Feature logic. Pure/IO-injected, no CLI dependency — reusable by
                             any future caller (CLI today, a UI/API later).

    diff.js                   diff(treeOld, treeNew) -> DiffResult
                               Generic tree-diff. No Directus knowledge, no I/O.

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
                                show/remove/extract). Pure orchestration: call normalizer/parser/store,
                                build a view via present/, return it. No console.log, no
                                process.exit, no commander. Reusable by a UI backend.
      extract.js               Extracts a partial EntityTree of added, removed, or modified entities.

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

Contract lives in `core/store/store.js` (JSDoc-only checklist, no code) — `list()`, `get(id)`, `set(tree, message?)`, `diffVersions(idA, idB)`, `removeLatest()`. `GitStore` (`core/store/git.js`) is the only implementation: every version is a full git commit of the tree (not a delta — reads are direct `git show`/`ls-tree`, never a replay chain). `removeLatest()` is a `git revert`, never destructive — every prior version stays readable via `get()`/`list()` afterward. **To add a backend** (e.g. sqlite): implement the `Store` contract, register it in `core/env.js`'s `createStore()` switch, and it must pass `test/store.contract.js`. No `core/operations/*.js` file changes — they only depend on the `Store` interface, injected via `createEnv()`.

### DiffResult — the shape diff() produces

```js
{ added: string[], removed: string[], modified: {key: string, changes: {path, from, to}[]}[] }
```

Documented as `@typedef {object} DiffResult` in [core/diff.js](../src/core/diff.js#L44-L49).

Produced by `core/diff.js`'s `diff(treeOld, treeNew)` — generic, no Directus knowledge. It is also consumed by the `extract` operation (`core/operations/extract.js`) to filter the EntityTree down to the matching set of keys depending on the chosen mode. Equality is `JSON.stringify` comparison (relies on `stripVolatile()` sorting object keys first — NOT a structural equality check). `changedPaths()` only recurses into plain objects; arrays are compared as whole values (one changed array element reports the entire array as changed, not a per-element diff). No rename detection — a remove + add is always two entries, never inferred as one rename (see [roadmap-draft.md](./roadmap-draft.md) stage 2).

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

## Configuration

Copy `.env.example` to `.env` to override defaults. All vars optional; explicit CLI flags always win.

| Var | Default | Affects |
|---|---|---|
| `SCHEMA_SNAPSHOT_OUT_DIR` | `.snapshot/normalized` | `normalize`/`extract`'s default `--out-dir` |
| `SCHEMA_SNAPSHOT_TYPE` | `directus` | `normalize`/`diff`/`add`/`remove`/`extract`'s default `--schema-type` |
| `SCHEMA_SNAPSHOT_SUBDIR_FORMAT` | `{time}_{name}` | `normalize`/`extract`'s default `--subdir-format` |
| `SCHEMA_SNAPSHOT_STORE_DIR` | `.snapshot/repo` | `diff`/`add`/`list`/`show`/`remove`/`extract`'s default `--store-dir` |
| `SCHEMA_SNAPSHOT_STORE_TYPE` | `git` | default `--store-type` (only `git` registered) |
| `SCHEMA_SNAPSHOT_FILE_FORMAT` | `json` | default `--file-format` (only `json` registered) |

Loaded once at CLI startup via `src/config.js` (`dotenv`).

## Errors

Missing file, unsupported extension, malformed JSON, unknown `--schema-type`/`--file-format`/`--store-type`, unresolvable version id — all print a clean `Error: ...` message and exit 1 (caught centrally in `cli/index.js`), never a raw stack trace.

## Design rule

CLI-first, UI-ready. Every feature lands as `core/operations/*.js` + `core/present/*.js` (lib) before `cli/commands/*.js` + `cli/render/*.js` (thin CLI glue) — the lib/CLI boundary is what makes a future Web UI additive instead of a rewrite.
