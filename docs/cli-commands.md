# CLI Commands

All commands: `normalize`, `diff`, `add`, `list`, `show`, `remove`. Every command supports `--json` (except `normalize`, which uses `--dry-run` for the machine-readable path) — the same view object `core/present/*.js` builds, for UI/programmatic use instead of screen-scraping.

## `schema-snapshot normalize <schema.json> [--out-dir <dir>] [--dry-run] [--schema-type <type>] [--subdir-format <format>] [--file-format <format>]`

Normalize a raw schema export into a canonical entity tree: one entry per collection/field/relation, volatile keys (`id`, `date_created`, `date_updated`, `user_created`, `user_updated`) stripped, object keys sorted.

Always writes to disk by default. Each run creates a fresh, uniquely named subdir, so re-running never overwrites a previous run.

- **Default**: writes under `.snapshot/normalized/<YYYYMMDD-HHmmss>_<basename-of-input>/`:
  - `<subdir>/<kind>/<name>.json` — one file per entity (e.g. `.../field/orders.status.json`)
  - `<subdir>/original.json` — copy of the raw input
  - `<subdir>/meta.json` — run summary: `input`, `timestamp`, `toolVersion`, `counts`, `collections` breakdown
- **`--out-dir <dir>`**: same layout, rooted at `<dir>` (default `.snapshot/normalized`, env `SCHEMA_SNAPSHOT_OUT_DIR`).
- **`--dry-run`**: no write — prints the normalized tree as JSON to stdout instead, no `meta.json` either. Takes precedence over `--out-dir`.
- **`--schema-type <type>`**: which normalizer to use, default `directus` (env `SCHEMA_SNAPSHOT_TYPE`). See [architecture.md#normalizer](./architecture.md#normalizer--pluggable-input-schema-type).
- **`--subdir-format <format>`**: template for the subdir name, default `{time}_{name}` (env `SCHEMA_SNAPSHOT_SUBDIR_FORMAT`). See [architecture.md#subdir-format](./architecture.md#subdir-format-normalize-only).
- **`--file-format <format>`**: which parser to use for the input file, default `json` (env `SCHEMA_SNAPSHOT_FILE_FORMAT`).

```
schema-snapshot normalize schema.json
schema-snapshot normalize schema.json --out-dir ./out
schema-snapshot normalize schema.json --dry-run
schema-snapshot normalize schema.json --subdir-format "{name}/{time}"
```

## `schema-snapshot diff <a> <b> [--schema-type <type>] [--store-dir <dir>] [--store-type <type>] [--file-format <format>] [--json]`

`a`/`b` are each **auto-detected**: an existing file path is normalized fresh; anything else is treated as a committed version id (resolved via the store, e.g. a SHA/prefix from `list`). Mixing is fine — `diff v1.json abc1234` compares a raw file against a committed version.

When both are version ids, the store's `diffVersions()` auto-sorts by commit-graph depth so `diff B A` and `diff A B` print the same old→new result regardless of argument order. When either is a file, argument order is respected as given.

Reports structural differences by entity key:
- `+` added entities
- `~` modified entities, with per-field `path: old -> new`
- `-` removed entities

```
schema-snapshot diff v1.json v2.json
schema-snapshot diff abc1234 def5678
schema-snapshot diff v1.json abc1234
```

Example output:
```
+ field:orders.tracking_number
~ field:orders.status
    type: "string" -> "enum"
- field:orders.legacy_flag

1 added, 1 modified, 1 removed
```

## `schema-snapshot add <schema.json> [-m, --message <message>] [--schema-type <type>] [--store-dir <dir>] [--store-type <type>] [--file-format <format>] [--json]`

Normalizes the input file and commits it as a new version to the store (git-backed by default). Prints the same diff-style output as `diff`, computed against the immediately preceding version (empty tree if this is the first commit).

```
schema-snapshot add schema.json -m "add tracking_number field"
```

## `schema-snapshot list [--store-dir <dir>] [--store-type <type>] [--json]`

Lists all committed versions, newest first: short id, timestamp, message.

```
schema-snapshot list
```

## `schema-snapshot show <id> [--store-dir <dir>] [--store-type <type>] [--json]`

Shows every entity in one committed version (`<id>` = full or short commit SHA from `list`), grouped by collection, with real fields/relations separated from Directus system fields (`id`, `date_created`, etc. — shown last).

```
schema-snapshot show abc1234
```

## `schema-snapshot remove --latest [--yes] [--schema-type <type>] [--store-dir <dir>] [--store-type <type>] [--file-format <format>] [--json]`

Removes the most recently committed version — **non-destructive**: implemented as a `git revert`, a new commit undoing the last one. Nothing is deleted or history-rewritten; the reverted version stays fully readable via `get`/`show`/`list` afterward.

- **`--latest`**: required — the only supported removal mode today (no `remove <id>`/`--force` yet, see [roadmap-draft.md](./roadmap-draft.md)).
- **Without `--yes`**: interactive confirmation, `[y/n/P]`. `P` (preview) shows the 3 most recent versions plus the diff that removal would undo (or a full `show` if there's no earlier version to diff against), then re-prompts.
- **`--yes`**: skips the prompt, removes immediately.

```
schema-snapshot remove --latest
schema-snapshot remove --latest --yes
```

## `schema-snapshot extract <old> <new> --mode <mode> [--no-dry-run] [--out-dir <dir>] [--subdir-format <format>] [--schema-type <type>] [--store-dir <dir>] [--store-type <type>] [--file-format <format>] [--snapshot] [--snapshot-file <path>] [--json]`

Extract a partial EntityTree snapshot of only `added`, `removed`, or `modified` entities between two schemas.

`<old>` and `<new>` are each **auto-detected**: an existing file path is normalized; anything else is treated as a committed version ID. 

Supported argument combinations are: `file` + `file`, `hash` + `file`, and `hash` + `hash`. Any combination where `<old>` is a file path and `<new>` is a version ID is rejected.

- **`--mode <mode>`**: **Required**. Filter mode: `added`, `removed`, or `modified`.
- **`--no-dry-run`**: Write files to disk. By default, `extract` only prints the result to stdout.
- **`--out-dir <dir>`**: Directory to write the extracted subfolder (default `.snapshot/normalized`, env `SCHEMA_SNAPSHOT_OUT_DIR`).
- **`--subdir-format <format>`**: Template for the subfolder name, default `{time}_{name}` (env `SCHEMA_SNAPSHOT_SUBDIR_FORMAT`). The `{name}` placeholder is resolved using the concatenated string `<old>_<new>`.
  - **GOTCHA**: Since the folder generator uses `path.basename` to extract `{name}` from the combined string, if the `<new>` argument is a file path containing `/` separators, any directories in that path (as well as the entire `<old>` argument) are stripped out of the `{name}` placeholder (e.g. `20f5c7f_/path/to/new.json` resolves to a `{name}` of `new`).
- **`--schema-type <type>`**: Which normalizer to use, default `directus` (env `SCHEMA_SNAPSHOT_TYPE`).
- **`--store-dir <dir>`**: Where the version store (git repo) lives, default `.snapshot/repo` (env `SCHEMA_SNAPSHOT_STORE_DIR`).
- **`--store-type <type>`**: Which Store implementation to use, default `git` (env `SCHEMA_SNAPSHOT_STORE_TYPE`).
- **`--file-format <format>`**: Which Parser to use for file arguments, default `json` (env `SCHEMA_SNAPSHOT_FILE_FORMAT`).
- **`--snapshot`**: Instead of writing one file per entity, reconstruct a **full** schema by overlaying the extracted delta onto `<old>` (`added`/`modified`: `old + delta`; `removed`: `old - delta`), and write it as a single `snapshot.json` + `meta.json` pair under the usual subfolder. Requires the normalizer to support `denormalize` (only `directus` today).
- **`--snapshot-file <path>`**: Same reconstruction as `--snapshot`, but written to an exact file path instead of the generated subfolder — companion metadata goes to `<path minus .json>.meta.json` (or `<path>.meta.json` if `<path>` doesn't end in `.json`).
- **`--json`**: Output the view data as JSON (in dry-run, outputs `{ mode, keys, dir, tree }`, plus `snapshot`/`meta`/`verification` when `--snapshot`/`--snapshot-file` is used; in write mode, outputs the presenter's view object, plus `verification` for snapshot writes).

### Merge verification (`--snapshot`/`--snapshot-file` only)

Every reconstructed snapshot is checked before being trusted: `core/operations/extract.js`'s `verifyMerge()` re-diffs `<old>` against the reconstructed tree and asserts the change set matches the extracted mode's key set exactly (see its GOTCHA doc comment for the single-mode assumption this relies on). This catches a bad merge, a stale `<old>` tree, or wrong mode handling *before* the file is trusted.

- On success, prints `✓ merge verified` after the normal extract output.
- On failure, prints `✗ merge verification failed: <details>` (details include any of `unexpectedAdded`, `unexpectedRemoved`, `unexpectedModified`, `missingKeys` that are non-empty).
- **Dry-run**: a failed verification only prints the `✗` line — nothing was written yet, so the process still exits `0`.
- **Real write (`--no-dry-run`)**: the file is written first (so it's on disk for inspection), then a failed verification throws, which the CLI's central error handler prints as `Error: merge verification failed: ...` and exits `1`. Scripts/CI calling `extract --snapshot --no-dry-run` should treat a non-zero exit as "snapshot may be wrong, don't trust it," not "nothing was written."

### Examples

#### Dry run (default) — added mode
```
$ schema-snapshot extract v1.json v2.json --mode added
{
  "field:orders.tracking_number": {
    "collection": "orders",
    "field": "tracking_number",
    "type": "string",
    "meta": {
      "interface": "input"
    }
  }
}

1 added -> .snapshot/normalized/20260703-114103_v1.json_v2 (dry run, nothing written; pass --no-dry-run to write)
```

#### Dry run (default) — modified mode
```
$ schema-snapshot extract v1.json v2.json --mode modified
{
  "field:orders.status": {
    "collection": "orders",
    "field": "status",
    "type": "enum",
    "meta": {
      "interface": "select",
      "options": {
        "choices": [
          { "text": "Draft", "value": "draft" },
          { "text": "Shipped", "value": "shipped" }
        ]
      }
    }
  }
}

1 modified -> .snapshot/normalized/20260703-114103_v1.json_v2 (dry run, nothing written; pass --no-dry-run to write)
```

#### Writing output (`--no-dry-run`) — added mode
```
$ schema-snapshot extract v1.json v2.json --mode added --no-dry-run
+ field:orders.tracking_number

1 added -> .snapshot/normalized/20260703-114103_v1.json_v2
```

#### Writing output (`--no-dry-run`) — modified mode
```
$ schema-snapshot extract v1.json v2.json --mode modified --no-dry-run
~ field:orders.status

1 modified -> .snapshot/normalized/20260703-114103_v1.json_v2
```

#### Reconstructed snapshot (`--snapshot --no-dry-run`) — added mode
```
$ schema-snapshot extract v1.json v2.json --mode added --snapshot --no-dry-run
+ field:orders.tracking_number

1 added snapshot -> .snapshot/normalized/20260703-114103_v1.json_v2/snapshot.json
✓ merge verified
```

#### `--json` output shape with a snapshot + verification
```
$ schema-snapshot extract v1.json v2.json --mode added --snapshot --no-dry-run --json
{
  "mode": "added",
  "keys": ["field:orders.tracking_number"],
  "count": 1,
  "dir": ".snapshot/normalized/20260703-114103_v1.json_v2",
  "file": ".snapshot/normalized/20260703-114103_v1.json_v2/snapshot.json",
  "verification": {
    "ok": true,
    "unexpectedAdded": [],
    "unexpectedRemoved": [],
    "unexpectedModified": [],
    "missingKeys": []
  }
}
```

## Global

```
schema-snapshot --help
schema-snapshot <command> --help
schema-snapshot --version
```

## Out of scope (not built yet)

- No `renamed_candidates` detection — a field removed + a field added always shows as separate remove/add, never a rename guess.
- No `remove <id>` / `--force` (destructive removal of a non-latest version).
- No `migrate-plan`/`apply`. See [roadmap-draft.md](./roadmap-draft.md) for the full ordered list.
