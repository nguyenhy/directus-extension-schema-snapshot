# Architecture

Status: `normalize`, `diff`, `add`, `list`, `show`, `get`, `remove`, `extract`, `sync`, `status` all implemented. See [roadmap-draft.md](./roadmap-draft.md) for what's still ahead (rename detection, migrate-plan/apply, Web UI, auto/manual sync toggle).

## Overview

CLI tool that normalizes a raw Directus schema JSON export into a flat, diffable `EntityTree`, computes structured diffs between versions, and stores each version as a git commit. Every command follows the same 4-layer pipeline: **`cli/commands`** (parse argv) → **`core/operations`** (orchestrate parser/normalizer/store) → **`core/present`** (build a plain view object) → **`cli/render`** (print, or raw JSON via `--json`). See "Flow" below for a concrete trace. Detailed data shapes, config, and the sync layer live in [reference.md](./reference.md) — this file covers structure and the request path only.

## Flow

Every command follows the same 4-layer pipeline. Concrete example, `add`:

```
cli/index.js (commander registers "add", parses argv)
  -> cli/commands/add.js: cmdAdd(inputPath, options)
       1. createEnv({storeDir, storeType, fileFormat})                // core/env.js — builds {store, parse}
       2. core/operations/add.js: addVersion({inputPath, schemaType, message, store, parse})
            a. parse(inputPath)                                       // core/parsers -> raw JSON object
            b. getNormalizer(schemaType).normalize(raw)               // core/directus/normalize.js -> EntityTree
            c. store.set(tree, message)                               // core/store/git.js -> commits, returns {id, previousTree}
            d. diff(previousTree, tree)                               // core/diff.js -> DiffResult
            e. buildAddView(id, message, result, ...)                 // core/present/add.js -> plain view object
       3. options.json ? JSON.stringify(view) : printAddView(view)    // cli/render/add.js -> stdout
```

Every other command (`diff`, `list`, `show`, `remove`, `normalize`, `extract`) is the same shape: **cli/commands (parse argv, build env)** → **core/operations (orchestrate: parser/normalizer/store/diff)** → **core/present (build plain view)** → **cli/render (print) or raw JSON (--json)**.

Note that `extract` follows the same 4-layer shape as `diff` (with file-vs-version auto-detect), restricted to three supported `<old>`/`<new>` combinations (`file`+`file`, `hash`+`file`, `hash`+`hash`) — see [reference.md](./reference.md#extract-dry-run-behavior) for details.

Why this split: `core/operations/*.js` never imports commander, console, or process — a future Web UI backend calls the exact same functions and gets the exact same view objects, only swapping the last hop (HTTP response instead of stdout print).

## Directory structure

```
├── src/
│   ├── core/                       # Feature logic. Pure/IO-injected, no CLI dependency.
│   │   ├── diff.js                 ## Generic tree-diff. No Directus knowledge, no I/O.
│   │   ├── hash.js                 ## Deterministic content hash — snapshot identity.
│   │   ├── snapshotSync/
│   │   │   ├── eventLog.js         ### meta.json + source/ read-write, fold-to-active-set logic.
│   │   │   └── resolve.js          ### event id / content hash -> GitStore commit id.
│   │   ├── directus/
│   │   │   └── normalize.js        ### Directus-specific: rawSchema -> EntityTree.
│   │   ├── normalizers/
│   │   │   └── index.js            ### getNormalizer(type) -> Normalizer registry.
│   │   ├── parsers/
│   │   │   └── index.js            ### getParser(format) -> Parser registry.
│   │   ├── store/
│   │   │   ├── store.js            ### Store contract (JSDoc typedef only).
│   │   │   └── git.js              ### GitStore — reference (and only) implementation.
│   │   ├── operations/             ## One file per command's pure orchestration logic.
│   │   │   ├── extract.js          ### Extract + mergeIntoOld()/verifyMerge() (see reference.md).
│   │   │   ├── sync.js             ### syncSnapshots() — full rebuild from meta.json, not incremental.
│   │   │   └── status.js           ### statusView() — read-only meta.json-hash vs sync-state comparison.
│   │   ├── present/                ## One file per command's view-builder (render-agnostic).
│   │   └── env.js                  ## createEnv(...) -> {store, parse} — composition root, see "Pluggable points" below.
│   ├── cli/                        # Everything specific to the command-line interface.
│   │   ├── index.js                ## commander setup: registers subcommands, wires flags, entrypoint.
│   │   ├── commands/               ## One file per command: commander action handler (thin glue).
│   │   └── render/                 ## One file per command: console.log formatting of a present/ view.
│   ├── utils/                      # Small, generic, feature-agnostic helpers.
│   │   ├── parseJson.js            ## parseJSONFile(path) -> object.
│   │   ├── fsTree.js               ## writeTreeToDir()/readTreeFromDir()/runSubDir().
│   │   └── timestamp.js            ## timestamp() formatter.
│   └── config.js                   # Reads .env / process.env (see reference.md#configuration).
├── fixtures/                       # Sample schema JSON pairs for manual/smoke testing.
├── docs/                           # Design docs — this file, reference.md, cli reference, roadmap.
└── test/                           # node:test suite (git-store.test.js, store.contract.js).
```

Per-file JSDoc in each source file documents its exact contract (`@param`/`@returns`, plus GOTCHA notes) — this tree is a map, not a restatement of that contract.

**Rule of thumb for where new code goes:**
- Knows what a "collection/field/relation" is, or talks to git/disk for persistence? → `core/`.
- One command's pure workflow (call normalizer → call store → build view)? → `core/operations/<command>.js`.
- Turning that workflow's output into a flat, renderable object? → `core/present/<command>.js`.
- Only makes sense from a terminal (flags, stdout, prompts)? → `cli/commands/` (parse args, call operation) + `cli/render/` (print the view).
- Generic enough for an unrelated project (timestamp formatting, generic file I/O)? → `utils/`.

## Pluggable points

### Normalizer — pluggable input schema type

```js
{ normalize(rawSchema) -> EntityTree }
```
Registry: `core/normalizers/index.js`, keyed by `--schema-type` (default `directus`). Only `directus` registered today. **To add one**: write a module exporting `normalize(rawSchema) -> EntityTree` with the same key format (`core/directus/normalize.js`'s `entityKey()`), add one entry to the map. No other file changes.

### Parser — pluggable input file format

```js
{ parse(filePath) -> object }
```
Registry: `core/parsers/index.js`, keyed by `--file-format` (default `json`). Only `json` registered today. **To add one** (e.g. yaml): write `utils/parseYaml.js`, register it.

### Store — pluggable version-persistence backend

Contract: `core/store/store.js` (JSDoc-only checklist — `list()`, `get(id)`, `getRaw(id)`, `set(tree, message?, raw?)`, `diffVersions(idA, idB)`, `removeLatest()`, `readMeta`/`writeMeta`, `reset()`). `GitStore` (`core/store/git.js`) is the only implementation — see [reference.md](./reference.md#store-contract-summary) for its specifics (revert-based removal, raw-source commit). **To add a backend**: implement the `Store` contract, register it in `core/env.js`'s `createStore()` switch, and pass `test/store.contract.js`. No `core/operations/*.js` changes — they only depend on the injected interface.

## Composition root: core/env.js

`createEnv({storeDir, storeType, fileFormat}) -> {store, parse}` is the **only** place a concrete `Store` or `Parser` is constructed (`new GitStore(...)` appears nowhere else). Every `cli/commands/*.js` calls it once, then passes `{store, parse}` into the matching `core/operations/*.js` function as injected dependencies. A future UI backend does the same — construct env once, call the same operation functions.

## Design rule

CLI-first, UI-ready. Every feature lands as `core/operations/*.js` + `core/present/*.js` (lib) before `cli/commands/*.js` + `cli/render/*.js` (thin CLI glue) — the lib/CLI boundary is what makes a future Web UI additive instead of a rewrite.

## See also

- [reference.md](./reference.md) — data structures (EntityTree/DiffResult), Store contract detail, subdir format, extract dry-run/snapshot-merge, schema-snapshots sync layer, configuration table, errors.
- [cli-commands.md](./cli-commands.md) — exact flags per command.
- [roadmap-draft.md](./roadmap-draft.md) — what's deliberately not built yet.
