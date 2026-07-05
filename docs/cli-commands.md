# CLI Commands

All commands: `init`, `normalize`, `diff`, `add`, `list`, `show`, `get`, `remove`, `sync`, `status`, `extract`.

```bash
schema-snapshot <command> --help    # authoritative flag list, always up to date
schema-snapshot --version
schema-snapshot --env-file <path> <command> ...   # explicit env path, before default cwd/.env.schema-snapshot (then cwd/.env) lookup
```

**`--env-file <path>`** (env `SCHEMA_SNAPSHOT_ENV_FILE`) — top-level option, not per-command. Pins which env file loads, since dotenv otherwise resolves against `process.cwd()`, which can silently differ from this package's own directory when invoked via a wrapper (e.g. `npm run`). See [reference.md#configuration](./reference.md#configuration).

## Global options

Repeat across most commands — documented once here instead of per-command `OPTIONS`.

**`--json`**
default: off. Machine-readable output (same view object `core/present/*.js` builds). `normalize` uses `--dry-run` instead.

**`--store-dir <dir>`** (env `SCHEMA_SNAPSHOT_STORE_DIR`)
default: `.snapshot/repo`. Local git-backed version cache, disposable/rebuildable.

**`--store-type <type>`** (env `SCHEMA_SNAPSHOT_STORE_TYPE`)
default: `git`. Only `git` registered today.

**`--snapshots-dir <dir>`** (env `SCHEMA_SNAPSHOT_SNAPSHOTS_DIR`)
default: `schema-snapshots`. Host-repo-tracked event log + source; commit this dir in your own repo.

**`--schema-type <type>`** (env `SCHEMA_SNAPSHOT_TYPE`)
default: `directus`. Only `directus` registered today.

**`--file-format <format>`** (env `SCHEMA_SNAPSHOT_FILE_FORMAT`)
default: `json`. Only `json` registered today.

**`--out-dir <dir>`** (env `SCHEMA_SNAPSHOT_OUT_DIR`)
default: `.snapshot/normalized`. `normalize`/`extract` only.

**`--subdir-format <format>`** (env `SCHEMA_SNAPSHOT_SUBDIR_FORMAT`)
default: `{time}_{name}`. `normalize`/`extract` only.

**`--cache-ref`**
default: off. Treat id/hash args as raw GitStore commit shas — see "Which id goes where" (below `list`).

---

## INIT

### NAME

init — scaffold a target directory for first use

### SYNOPSIS

```bash
schema-snapshot init [dir] [--store-dir <dir>] [--store-type <type>] [--json]
```

### DESCRIPTION

One-command onboarding: copies the bundled `.env.schema-snapshot.example` template, writes a `.gitignore` entry for the local store cache, and initializes the local GitStore — replaces five manual setup steps (mkdir, copy env template, edit `.gitignore`, `git init` the cache, remember the cwd/.env gotcha) with one.

`dir` defaults to `.` (cwd). `init` rejects if `dir` already looks initialized (`schema-snapshots/` or `.snapshot/` present) or has unrelated content already — see "Reject conditions" below.

**Where `.env.schema-snapshot` goes:** the nearest ancestor directory containing a `package.json`, walking up from `dir` (including `dir` itself) — matching how a user would `cd` into their project root and run commands without `--env-file`. If no `package.json` is found anywhere up the tree, it's written directly into `dir`. The local store cache and `.gitignore` always stay local to `dir`, regardless of where `.env.schema-snapshot` landed.

**Why `.env.schema-snapshot`, not `.env`:**
- **Isolation** — schema-snapshot's config never mixes with a host app's own env vars.
- **Prevents accidental overwrite** — `init` can never clobber a `.env` the host project already depends on; if one exists at the resolved root, it's simply untouched.
- You're still free to consolidate manually — copy the values into your own `.env`, or point `--env-file`/`SCHEMA_SNAPSHOT_ENV_FILE` at whichever file you prefer. `init`'s default is the safe default, not a requirement.

**Why not a JSON/JS config file instead:** deferred, not rejected. `.env` was chosen first because it's the convention every Node dev already expects, and it matches the existing `SCHEMA_SNAPSHOT_*` env-var surface every other command already reads (see [Global options](#global-options) above). A `schema-snapshot.config.json`/`.js` loader can layer on top of this later without breaking it — env vars would still win over config-file values, same precedence `envOr()` already uses today.

**Reject conditions:**
- `dir` contains `schema-snapshots/` or `.snapshot/` — already initialized; `init` is a one-time setup, not an idempotent sync. Run commands directly instead.
- `dir` has other real content (not OS junk, not `.env`/`.env.schema-snapshot`/`package.json`) — likely the wrong target; pick an empty dir. `.env`/`package.json` are allowed to preexist since `dir` may legitimately already be a project root.

### OPTIONS

| flag                   | meaning                                                  |
| ----------------------- | --------------------------------------------------------- |
| `[dir]`                | target directory, default `.`                              |
| `--store-dir <dir>`    | store cache dir, created inside `dir` (see Global options) |
| `--store-type <type>`  | see Global options                                          |
| `--json`               | output the init view as JSON (for UI / programmatic use)   |

### EXAMPLES

```bash
schema-snapshot init                 # scaffold cwd
schema-snapshot init ./my-project    # scaffold a specific dir
schema-snapshot init . --json        # machine-readable result
```

### SEE ALSO

[reference.md#configuration](./reference.md#configuration)

---

## NORMALIZE

### NAME

normalize — turn a raw schema export into a canonical entity tree

### SYNOPSIS

```bash
schema-snapshot normalize <schema.json> [--out-dir dir] [--dry-run] [--schema-type type] [--subdir-format fmt] [--file-format fmt]
```

### DESCRIPTION

Reads a raw schema export and produces one entry per collection/field/relation, with volatile keys (`id`, `date_created`, `date_updated`, `user_created`, `user_updated`) stripped and object keys sorted. Always writes to disk by default, under a fresh timestamped subdirectory — a second run never overwrites the first. `--dry-run` prints the tree to stdout instead of writing anything.

### OPTIONS

| flag                       | meaning                                                           |
| -------------------------- | ----------------------------------------------------------------- |
| `--out-dir <dir>`          | see Global options                                                |
| `--dry-run`                | no write, print tree to stdout; takes precedence over `--out-dir` |
| `--schema-type <type>`     | see Global options                                                |
| `--subdir-format <format>` | see Global options                                                |
| `--file-format <format>`   | see Global options                                                |

### EXAMPLES

```bash
schema-snapshot normalize schema.json                                  # write to .snapshot/normalized/<timestamp>_schema/
schema-snapshot normalize schema.json --dry-run                        # print tree to stdout, write nothing
schema-snapshot normalize schema.json --out-dir ./out                  # write under ./out instead
schema-snapshot normalize schema.json --subdir-format "{name}/{time}"  # custom subdir naming
```

### SEE ALSO

[architecture.md#subdir-format](./architecture.md#subdir-format-normalize-only), [architecture.md#normalizer](./architecture.md#normalizer--pluggable-input-schema-type)

---

## DIFF

### NAME

diff — compare two schemas and report structural differences

### SYNOPSIS

```bash
schema-snapshot diff <a> <b> [--cache-ref] [--json] [global options]
```

### DESCRIPTION

Compares schema `a` against schema `b` entity by entity. Each argument is auto-detected: an existing file path is normalized fresh, anything else is treated as an event id or content hash and resolved against the committed version history. Output lists added, removed, and modified entities, with per-field old→new values for modifications.

### OPTIONS

| flag                                                                               | meaning                   |
| ---------------------------------------------------------------------------------- | ------------------------- |
| `--cache-ref`                                                                      | see "Which id goes where" |
| `--json`                                                                           | see Global options        |
| `--store-dir`, `--store-type`, `--schema-type`, `--file-format`, `--snapshots-dir` | see Global options        |

### EXAMPLES

```bash
schema-snapshot diff v1.json v2.json               # compare two raw files
schema-snapshot diff e1 e2                         # compare two committed versions by event id
schema-snapshot diff v1.json e2                    # compare a raw file against a committed version
schema-snapshot diff --cache-ref abc1234 def5678   # compare two raw git commit shas directly
```

```
+ field:orders.tracking_number
~ field:orders.status
    type: "string" -> "enum"
- field:orders.legacy_flag

1 added, 1 modified, 1 removed
```

When both sides are committed versions, output is always old→new regardless of argument order. With a file argument, the order you type is the order used.

### SEE ALSO

"Which id goes where" (below `list`)

---

## ADD

### NAME

add — normalize a schema and commit it as a new version

### SYNOPSIS

```bash
schema-snapshot add <schema.json> [-m, --message msg] [global options]
```

### DESCRIPTION

Normalizes the given schema file and commits the result as a new version in the local version store. Prints a diff-style summary against the immediately preceding version. Also records the event and the raw source in a separate, host-repo-tracked log so other commands and other machines can resolve it later.

### OPTIONS

| flag                                                                                         | meaning                         |
| -------------------------------------------------------------------------------------------- | ------------------------------- |
| `-m, --message <message>`                                                                    | commit message for this version |
| `--store-dir`, `--store-type`, `--schema-type`, `--file-format`, `--snapshots-dir`, `--json` | see Global options              |

### EXAMPLES

```bash
schema-snapshot add schema.json -m "add tracking_number field"   # normalize + commit as a new version
```

### SEE ALSO

[proposal-schema-snapshot-sync.md §2](./proposal-schema-snapshot-sync.md#2-proposed-solution) — why the dual-write to `--snapshots-dir` exists

---

## LIST

### NAME

list — list all committed schema versions

### SYNOPSIS

```bash
schema-snapshot list [--show-cache-ref] [--json] [global options]
```

### DESCRIPTION

Prints every recorded version, newest first, with its event id, action, and timestamps. Each row shows enough to reference the version from `show`, `get`, `diff`, or `remove` without needing the underlying git commit sha.

### OPTIONS

| flag                                                       | meaning                                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `--show-cache-ref`                                         | also print the git commit sha (hidden by default — same hex shape as a content hash) |
| `--store-dir`, `--store-type`, `--snapshots-dir`, `--json` | see Global options                                                                   |

### EXAMPLES

```bash
schema-snapshot list                     # newest-first, event id + content hash per row
schema-snapshot list --show-cache-ref    # also show the underlying git commit sha
```

### SEE ALSO

"Which id goes where" below

---

## Which id goes where

`list` above just gave you two things to reference a version by: an **event id** like `e3`, and a **content hash** (sha256 hex). Both work everywhere `<id>` shows up in the commands below — `show`, `get`, `diff`, `extract`, `remove --hash`.

| id           | looks like     | where you'd normally see it                                   |
| ------------ | -------------- | ------------------------------------------------------------- |
| event id     | `e3`           | `list` output; pass straight to `show`/`get`/`diff`/`extract` |
| content hash | sha256 hex     | also `list` output; same commands, or `remove --hash`         |
| cache-ref    | git commit sha | `list --show-cache-ref`; only with `--cache-ref`              |

There's a third kind, the **cache-ref** (a raw git commit sha) — internal, disposable, regenerated by every `sync`. You shouldn't need it day to day; it exists for debugging the local store directly, via the explicit `--cache-ref` flag.

**Why `--cache-ref` must be explicit:** a content hash and a cache-ref are both plain hex, so the CLI can't tell them apart by looking — it always assumes hash unless you say `--cache-ref`. Guessing wrong there would silently resolve the wrong version, so the tool refuses to guess at all.

One prerequisite: resolving an event id or hash requires `sync` to have run at least once (it builds the lookup). If a command says "not found in the local GitStore cache," run `sync` first.

Full internals: [proposal-schema-snapshot-sync.md §5.2](./proposal-schema-snapshot-sync.md#52-implementation-notes-and-trade-offs-not-visible-in-code-comments).

---

## SHOW

### NAME

show — display every entity in a committed version

### SYNOPSIS

```bash
schema-snapshot show <id> [--cache-ref] [--json] [global options]
```

### DESCRIPTION

Reconstructs and prints the full normalized entity tree for one committed version, grouped by collection, with ordinary fields separated from Directus system fields.

### OPTIONS

| flag                                                       | meaning                   |
| ---------------------------------------------------------- | ------------------------- |
| `--cache-ref`                                              | see "Which id goes where" |
| `--store-dir`, `--store-type`, `--snapshots-dir`, `--json` | see Global options        |

### EXAMPLES

```bash
schema-snapshot show e3                    # show version by event id
schema-snapshot show 94c6dc9                # show version by content hash
schema-snapshot show --cache-ref abc1234    # show version by raw git commit sha
```

### SEE ALSO

`get` (raw source instead of reconstructed tree)

---

## GET

### NAME

get — retrieve the original raw source of a committed version

### SYNOPSIS

```bash
schema-snapshot get <id> [--cache-ref] [--out-file path] [--json] [global options]
```

### DESCRIPTION

Returns the exact raw schema file as it was originally committed by `add` — no normalization, no reconstruction, no merge. Requires that the target version was committed with its raw source attached; throws otherwise.

### OPTIONS

| flag                                                       | meaning                              |
| ---------------------------------------------------------- | ------------------------------------ |
| `--out-file <path>`                                        | write to this file instead of stdout |
| `--cache-ref`                                              | see "Which id goes where"            |
| `--store-dir`, `--store-type`, `--snapshots-dir`, `--json` | see Global options                   |

### EXAMPLES

```bash
schema-snapshot get e3                       # print original raw source to stdout
schema-snapshot get e3 --out-file v1.json    # write original raw source to a file
schema-snapshot get e3 --json                # output {id, raw} as JSON
schema-snapshot get --cache-ref abc1234      # fetch by raw git commit sha instead of id/hash
```

### SEE ALSO

`show` (reassembled normalized tree), `extract --snapshot` (delta overlaid onto an old tree)

---

## REMOVE

### NAME

remove — undo a committed version, without deleting history

### SYNOPSIS

```bash
schema-snapshot remove --latest [--yes] [global options]
schema-snapshot remove --hash <hash> | --id <eventId> [--snapshots-dir dir] [--json]
```

### DESCRIPTION

Reverts a version's effect without deleting or rewriting any commit. `--latest` undoes the most recently committed version and is safely repeatable. `--hash`/`--id` instead marks any specific past version as inactive, for cases where the version to remove isn't the newest one. `--latest` and `--hash`/`--id` are mutually exclusive.

### OPTIONS

| flag                                                                                         | meaning                                                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `--latest`                                                                                   | revert the most recently committed version (git revert, non-destructive) |
| `--yes`                                                                                      | skip the confirmation prompt (`--latest` only)                           |
| `--hash <hash>`                                                                              | target the latest active `add` event matching this content hash          |
| `--id <eventId>`                                                                             | target one exact event, for disambiguating a hash re-added after removal |
| `--schema-type`, `--store-dir`, `--store-type`, `--file-format`, `--snapshots-dir`, `--json` | see Global options                                                       |

### EXAMPLES

```bash
schema-snapshot remove --latest              # revert most recent version, ask for confirmation
schema-snapshot remove --latest --yes        # same, skip the prompt
schema-snapshot remove --hash 94c6dc9        # tombstone the latest active add matching this hash
schema-snapshot remove --id e2               # tombstone this exact event (disambiguates repeats)
```

Without `--yes`, `--latest` prompts `[y/n/P]` — `P` previews the 3 most recent versions plus the diff removal would undo, then re-prompts.

`--latest` is a repeatable toggle: 1st call undoes an `add`, 2nd undoes that undo, 3rd undoes that, and so on — `list`'s `undo <eventId>` action shows which event each call undid.

**Caution:** targeting a non-newest active event via `--hash`/`--id` makes the resulting log un-replayable by `sync` (it can only revert current HEAD, not an arbitrary historical commit) — safe only if you always target the most recently active event.

### SEE ALSO

`sync` (replay semantics this interacts with)

---

## SYNC

### NAME

sync — rebuild the local version cache from the tracked event log

### SYNOPSIS

```bash
schema-snapshot sync [global options]
```

### DESCRIPTION

Wipes the local version store and replays it from scratch using the full history recorded in the tracked event log (`add` and `remove` events alike, in log order). Not incremental — every run discards whatever was locally present and reconstructs it. Run after a `git pull` brings in new events, or when `status` reports stale.

### OPTIONS

| flag                                                                        | meaning            |
| --------------------------------------------------------------------------- | ------------------ |
| `--schema-type`, `--store-dir`, `--store-type`, `--snapshots-dir`, `--json` | see Global options |

### EXAMPLES

```bash
schema-snapshot sync   # rebuild .snapshot/repo from scratch out of schema-snapshots/meta.json
```

If the store already has commits, prints `Discarding N local commit(s) in <store-dir> and rebuilding from <snapshots-dir>...` before wiping. Throws if the log contains a `remove --hash`/`--id` event targeting a non-newest active event at replay time.

### SEE ALSO

`remove`'s caution note above

---

## STATUS

### NAME

status — check whether the local cache matches the tracked event log

### SYNOPSIS

```bash
schema-snapshot status [global options]
```

### DESCRIPTION

Read-only comparison between the tracked event log's current state and what the local cache was last synced to. Never modifies anything; the only way to check sync state without side effects.

### OPTIONS

| flag                                       | meaning            |
| ------------------------------------------ | ------------------ |
| `--store-dir`, `--snapshots-dir`, `--json` | see Global options |

### EXAMPLES

```bash
schema-snapshot status   # check local cache is in sync with schema-snapshots/meta.json
```

### SEE ALSO

`sync`

---

## EXTRACT

### NAME

extract — pull out only the added, removed, or modified entities between two schemas

### SYNOPSIS

```bash
schema-snapshot extract <old> <new> --mode added|removed|modified [--no-dry-run] [--snapshot] [--snapshot-file path] [--cache-ref] [--json] [global options]
```

### DESCRIPTION

Computes the difference between two schemas like `diff`, but instead of a report, produces a partial entity tree containing only the entities matching the chosen mode. Can optionally reconstruct a full schema file by overlaying that partial delta back onto the old schema, with the result automatically verified before being trusted.

### OPTIONS

| flag                                          | meaning                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `--mode <mode>`                               | **required** — `added`, `removed`, or `modified`                                                       |
| `--no-dry-run`                                | write files to disk (default: print to stdout only)                                                    |
| `--snapshot`                                  | reconstruct a full schema by overlaying the delta onto `<old>`, write as `snapshot.json` + `meta.json` |
| `--snapshot-file <path>`                      | same reconstruction, written to an exact path instead                                                  |
| `--cache-ref`                                 | see "Which id goes where"                                                                              |
| `--out-dir <dir>`, `--subdir-format <format>` | see Global options                                                                                     |
| `--schema-type`                               | see Global options                                                                                     |
| `--store-dir`,                                | see Global options                                                                                     |
| `--store-type`,                               | see Global options                                                                                     |
| `--file-format`                               | see Global options                                                                                     |
| `--snapshots-dir`,                            | see Global options                                                                                     |
| ``--json`                                     | see Global options                                                                                     |

Supported `<old>`/`<new>` combinations: file+file, id/hash+file, id/hash+id/hash. `<old>` as a file with `<new>` as an id/hash is rejected.

### EXAMPLES

```bash
schema-snapshot extract v1.json v2.json --mode added                          # dry-run, print only added entities
schema-snapshot extract v1.json v2.json --mode added --no-dry-run             # write added entities to disk
schema-snapshot extract v1.json v2.json --mode modified --no-dry-run          # write only modified entities to disk
schema-snapshot extract v1.json v2.json --mode added --snapshot --no-dry-run  # write a full reconstructed schema
```

```
$ schema-snapshot extract v1.json v2.json --mode added --snapshot --no-dry-run
+ field:orders.tracking_number

1 added snapshot -> .snapshot/normalized/20260703-114103_v1.json_v2/snapshot.json
✓ merge verified
```

Every reconstructed snapshot is re-diffed against `<old>` to confirm the change set matches the extracted mode exactly. On success: `✓ merge verified`. On failure in dry-run: `✗ merge verification failed: ...`, nothing written, exit 0. On failure with `--no-dry-run`: the file is written first (for inspection), then the process throws and exits 1 — treat a non-zero exit as "don't trust this file," not "nothing was written."

**Gotcha:** `--subdir-format`'s `{name}` placeholder is derived via `path.basename` on the resolved `<old>_<new>` string — if `<new>` is a file path containing `/`, directories in it (and all of `<old>`) get stripped from `{name}` (cosmetic only).

### SEE ALSO

`diff` (same comparison, report instead of extraction), [core/operations/extract.js](../src/core/operations/extract.js)'s `verifyMerge()` doc comment

---

## Out of scope (not built yet)

See [roadmap-draft.md](./roadmap-draft.md) for the full ordered list.

- No `renamed_candidates` detection — a field removed + a field added always shows as separate remove/add, never a rename guess.
- No destructive `--force` removal of a non-latest version (both removal modes are non-destructive by construction).
- No auto/manual sync toggle — `sync` is always manual.
- No `migrate-plan`/`apply`.
