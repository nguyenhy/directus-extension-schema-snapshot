# Architecture

## Directory structure

```
src/
  core/               Feature logic. Pure functions, no I/O, no CLI dependency — reusable by any
                       future caller (CLI today, a UI/API later).
    diff.js              diff(treeOld, treeNew) -> result       // -> { added, removed, modified }
                          Generic — operates on any flat "kind:name"-keyed entity map, no
                          Directus knowledge.
    directus/
      normalize.js         normalize(rawSchema) -> tree          // -> { "kind:name": entity, ... }
                            Directus-specific — reads collections/fields/relations, strips
                            Directus system fields.
    normalizers/
      index.js              getNormalizer(type) -> Normalizer — registry + lookup, see
                             "Normalizers" section below.

  cli/                Everything specific to the command-line interface.
    index.js             commander setup: registers subcommands, wires options, entrypoint (`bin`)
    commands/
      normalize.js        cmdNormalize() — calls core/directus/normalize.js, handles CLI-side
                           concerns (writing files, building meta.json, --dry-run vs. write)
      diff.js              cmdDiff() — calls core/diff.js, formats +/~/- text output

  utils/              Small, generic, feature-agnostic helpers — no schema/business knowledge.
    parse.js             parseFile(path) -> object   // read + validate a .json file
    fsTree.js            runSubDir(), writeTreeToDir() — generic "write object tree to disk" helpers
    timestamp.js         timestamp() — YYYYMMDD-HHmmss formatter

  config.js           Reads .env / process.env into one exported config object. The only file
                       that touches process.env directly — everything else takes config as input.

fixtures/             Sample schema JSON pairs used for manual/smoke testing (v1.json, v2.json).
docs/                 Design docs — this file, roadmap detail, CLI command reference.
```

**Rule of thumb for where new code goes:** does it know what a "collection/field/relation" is? → `core/`. Does it only make sense from a terminal (flags, stdout formatting, file-writing side effects)? → `cli/commands/`. Is it generic enough to use in a totally unrelated project (timestamp formatting, generic file I/O)? → `utils/`.

## Normalizers

`normalize` and `diff` both take a `--schema-type <type>` flag (default `directus`) that selects which normalizer converts raw input into the flat `{"kind:name": entity}` tree `diff()` operates on. Selection goes through a registry, not a hardcoded import, so adding a new schema type never touches `core/diff.js`, `utils/fsTree.js`, or the CLI's diff/write logic — they only ever see the resulting tree, never raw input.

- **Contract** (`core/normalizers/index.js`, JSDoc `@typedef {object} Normalizer`): `{ normalize(rawSchema) -> tree }`.
- **Registry**: `normalizers = { directus: require('../directus/normalize') }`. `directus` is currently the only registered implementation.
- **Lookup**: `getNormalizer(type)` throws a clear error (`Unknown schema type "x". Available: directus`) on an unregistered type, rather than silently producing an empty tree.
- **To add a new type**: write a module exporting `normalize(rawSchema) -> tree` matching the same key format, register it in `normalizers`, done — no other file needs to change.

## Subdir format

Every non-dry-run `normalize` writes into a fresh subdir of `--out-dir`, named from a template so repeated runs never collide. Controlled by `--subdir-format` (default `{time}_{name}`), overridable via `SCHEMA_SNAPSHOT_SUBDIR_FORMAT`.

- **Placeholders**: `{name}` — basename of the input file, no extension (e.g. `v1.json` → `v1`). `{time}` — `YYYYMMDD-HHmmss`.
- **Default `{time}_{name}`**: time-first so `ls`/`find` sorted output reads chronologically across *all* inputs, not grouped by filename first (the old default, `{name}_{time}`, sorted by name first — runs on different input files never interleaved chronologically).
- **Custom examples**:
  - `{name}_{time}` — old default, groups by input name first.
  - `{name}/{time}` — nested layout, one directory per input file, timestamped runs inside it.
  - `run-{time}` — drop the input name entirely if you always normalize the same file.
- **Validation** (`utils/fsTree.js`'s `runSubDir()`), all fail fast with a clear `Error:` before any write happens:
  - Must use at least one of `{name}`/`{time}` — a static string isn't unique across runs, defeats the no-collision guarantee.
  - Unknown placeholders (e.g. `{foo}`) are rejected, not silently left as literal text.
  - The rendered result can't contain an empty, `.`, or `..` path segment — `..` specifically would let the subdir escape `--out-dir`.

## Configuration

Copy `.env.example` to `.env` to override defaults. All vars optional.

| Var | Default | Affects |
|---|---|---|
| `SCHEMA_SNAPSHOT_OUT_DIR` | `.snapshot/normalized` | `normalize`'s default `--out-dir` when the flag isn't passed |
| `SCHEMA_SNAPSHOT_TYPE` | `directus` | `normalize`/`diff`'s default `--schema-type` when the flag isn't passed |
| `SCHEMA_SNAPSHOT_SUBDIR_FORMAT` | `{time}_{name}` | `normalize`'s default `--subdir-format` when the flag isn't passed — see [Subdir format](#subdir-format) |

Loaded once at CLI startup via `src/config.js` (`dotenv`); explicit `--out-dir` on the command line always wins over the env var.

## Errors

Missing file, unsupported extension (only `.json` accepted in stage 1), and malformed JSON all print a clean `Error: ...` message and exit 1 — no raw stack traces. See `src/utils/parse.js`.

## Design rule

CLI-first. Every feature lands as a lib function + thin CLI command before any UI work starts — the lib/CLI boundary is what makes a future Web UI additive instead of a rewrite.
