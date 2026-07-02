# CLI Commands

Stage 1: `normalize` + `diff` only. No storage — operates directly on schema JSON files.

## `schema-snapshot normalize <schema.json> [--out-dir <dir>] [--dry-run] [--schema-type <type>]`

Normalize a raw Directus schema export into a canonical entity tree: one entry per collection/field/relation, volatile keys (`id`, `date_created`, `date_updated`, `user_created`, `user_updated`) stripped, object keys sorted.

Always writes to disk by default — no flags needed. Each run creates a fresh, uniquely named subdir, so re-running never overwrites a previous run.

- **Default**: writes under `.snapshot/normalized/<basename-of-input>_<YYYYMMDD-HHmmss>/`:
  - `<subdir>/<kind>/<name>.json` — one file per entity (e.g. `.../field/orders.status.json`)
  - `<subdir>/original.json` — copy of the raw input
  - `<subdir>/meta.json` — run summary: `input`, `timestamp`, `toolVersion`, `counts` (collections/fields/relations totals), `collections` (per-collection field/relation name breakdown)
- **`--out-dir <dir>`**: same layout, rooted at `<dir>` instead of the default `.snapshot/normalized`.
- **`--dry-run`**: no write at all — prints the normalized tree as JSON to stdout instead (graph view), no `meta.json` either. Takes precedence if combined with `--out-dir`.
- **`--schema-type <type>`**: which normalizer to use, default `directus` (overridable via `SCHEMA_SNAPSHOT_TYPE` env var). `directus` is currently the only registered type — an unrecognized type errors immediately (`Unknown schema type "x". Available: directus`) instead of silently producing an empty tree. See [architecture.md](./architecture.md#normalizers).

```
schema-snapshot normalize schema.json
schema-snapshot normalize schema.json --out-dir ./out
schema-snapshot normalize schema.json --dry-run
schema-snapshot normalize schema.json --schema-type directus
```

## `schema-snapshot diff <schema_old.json> <schema_new.json> [--schema-type <type>]`

Normalizes both files (same `--schema-type` selection as `normalize`, default `directus`), then reports structural differences by entity key:

- `+` added entities
- `~` modified entities, with per-field `path: old -> new`
- `-` removed entities

```
schema-snapshot diff v1.json v2.json
```

Example output:
```
+ field:orders.tracking_number
~ field:orders.status
    type: "string" -> "enum"
- field:orders.legacy_flag

1 added, 1 modified, 1 removed
```

## Global

```
schema-snapshot --help
schema-snapshot <command> --help
schema-snapshot --version
```

## Out of scope (stage 1)

- No `renamed_candidates` detection — a field removed + a field added always shows as separate remove/add, never a rename guess.
- No storage/versioning — `add`/`list`/`show`/`export`/`import` land in stage 2 ([roadmap-draft.md](./roadmap-draft.md)).
- No `migrate-plan`/`apply` — deferred, not scoped yet.
