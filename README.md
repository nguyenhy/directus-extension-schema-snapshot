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

**Implemented:** `normalize`, `diff`, `add`, `list`, `show`, `remove` — git-backed version storage (every version = one commit), CLI only.

**Not yet built:** rename detection, extract, migrate-plan/apply, rollback plan, SQLite index, Web UI. See [Roadmap](./docs/roadmap-draft.md) for the ordered list — do not assume any of that exists in the code today.

## Versioning

Pre-`1.0.0`: no public API stability guarantee — internal module paths (`core/operations/*`, `core/env.js`, etc.) may move without a major bump. `1.0.0` will freeze a curated export surface (`src/index.js`) and the `EntityTree`/diff-view JSON shapes as the stable contract; changes to those after that point follow semver. See [CHANGELOG.md](./CHANGELOG.md).

## Install

```
npm install
cp .env.example .env   # optional, see docs/architecture.md
```

Runs via `node src/cli/index.js <command>` (or `npm link` to expose the `schema-snapshot` bin from `package.json`).

## Commands

- `normalize <schema.json> [--out-dir <dir>] [--dry-run]` — normalize a schema export into a canonical entity tree, written to disk by default.
- `diff <a> <b>` — structural diff between two schemas (file paths or committed version ids, auto-detected).
- `add <schema.json> [-m <message>]` — normalize + commit a new version to the store.
- `list` — list all committed versions, newest first.
- `show <id>` — show every entity in one committed version.
- `remove --latest [--yes]` — non-destructively undo the most recent version (git revert).

```
node src/cli/index.js normalize schema.json
node src/cli/index.js diff v1.json v2.json
node src/cli/index.js add schema.json -m "initial import"
node src/cli/index.js list
node src/cli/index.js --help
```

Full flag reference, output layout, and examples: [docs/cli-commands.md](./docs/cli-commands.md).

## More docs

- [docs/architecture.md](./docs/architecture.md) — directory structure, flow, pluggable data structures (Normalizer/Parser/Store), configuration
- [docs/cli-commands.md](./docs/cli-commands.md) — full command reference
- [docs/roadmap-draft.md](./docs/roadmap-draft.md) — what's next, in order
- [CLAUDE.md](./CLAUDE.md) — AI agent onboarding: conventions, invariants, where to look first
