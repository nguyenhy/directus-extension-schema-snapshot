# schema-snapshot

## What it is

A small toolset that turns a raw JSON schema snapshot (e.g. Directus schema export) into a git-diffable, AI-readable format, then computes structured diffs between two versions (added / removed / modified).

## What it's not

- Not a database migration framework (no rollback engine, no query builder) — planned migration-apply layer will call existing SDK operations (e.g. Directus SDK), not run raw SQL.
- Not a live schema sync tool — works on snapshots you export, not a continuous watcher.
- Not a data migration tool — does not infer or write backfill logic (e.g. copying `sku` → `sku_id`). Backfill stays manual, deliberately — only a human knows the business meaning of a rename/reshape.
- Not Directus-only in concept, but not there yet — diffing is generic, normalizing is currently Directus-specific. A generic-JSON normalizer is future work (see [Roadmap](./docs/roadmap-draft.md)).

## Why we need it

Schema snapshots as one giant JSON blob are hard to diff, hard to review in a PR, and hard for an AI agent to reason about (context-heavy, unstructured). This tool normalizes a snapshot into a structured, per-entity form and computes a clean diff between two versions.

## Status

**Implemented (stage 1):** `normalize` + `diff`, CLI only, no storage.

**Not yet built:** everything under [Roadmap](./docs/roadmap-draft.md) — no `add`/version storage, no rename detection, no migrate-plan/apply, no UI. Do not assume any of that exists in the code today.

## Install

```
npm install
cp .env.example .env   # optional, see docs/architecture.md
```

Runs via `node src/cli/index.js <command>` (or `npm link` to expose the `schema-snapshot` bin from `package.json`).

## Commands

- `normalize <schema.json> [--out-dir <dir>] [--dry-run]` — normalize a schema export into a canonical entity tree, written to disk by default.
- `diff <schema_old.json> <schema_new.json>` — structural diff between two schema files (added/modified/removed).

```
node src/cli/index.js normalize schema.json
node src/cli/index.js diff v1.json v2.json
node src/cli/index.js --help
```

Full flag reference, output layout, and examples: [docs/cli-commands.md](./docs/cli-commands.md).

## More docs

- [docs/architecture.md](./docs/architecture.md) — directory structure, configuration, error handling
- [docs/cli-commands.md](./docs/cli-commands.md) — full command reference
- [docs/roadmap-draft.md](./docs/roadmap-draft.md) — what's next, in order
