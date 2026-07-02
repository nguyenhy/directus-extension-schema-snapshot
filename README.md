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

