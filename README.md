# schema-snapshot

> **Pre-1.0, unstable.** Breaking changes may land at any time without notice. Pin an exact version if you depend on this.

## What it is

A small toolset that turns a raw JSON schema snapshot (e.g. Directus schema export) into a git-diffable, AI-readable format, then computes structured diffs between two versions (added / removed / modified).

## What it's not

- Not a database migration framework (no rollback engine, no query builder) — planned migration-apply layer will call existing SDK operations (e.g. Directus SDK), not run raw SQL.
- Not a live schema sync tool — works on snapshots you export, not a continuous watcher.
- Not a data migration tool — does not infer or write backfill logic (e.g. copying `sku` → `sku_id`). Backfill stays manual, deliberately — only a human knows the business meaning of a rename/reshape.
- Not Directus-only in concept, but not there yet — diffing is generic, normalizing is currently Directus-specific. A generic-JSON normalizer is future work (see [Roadmap](./docs/roadmap-draft.md)).

## Why we need it

Schema snapshots as one giant JSON blob are hard to diff, hard to review in a PR, and hard for an AI agent to reason about (context-heavy, unstructured). This tool normalizes a snapshot into a structured, per-entity form and computes a clean diff between two versions.

## Use case

- **Reviewable schema PRs** — export schema before/after a change, `add` both, `diff` them, get a per-field added/removed/modified list instead of a raw JSON diff.
- **Schema history** — `add` a version each time you export, `list`/`show` to see what changed and when, without a live DB connection.
- **Partial handoff** — `extract` just the added/removed/modified entities between two versions (e.g. to hand a delta to another environment) instead of shipping the full schema.

## Quickstart

**1. Install / setup** — no install needed to try it:

```
npx schema-snapshot --help
```

Or add as a dependency:

```
npm install schema-snapshot
cp .env.example .env   # optional config override, see docs/architecture.md
```

(From a cloned repo without `npm link`, swap `npx schema-snapshot` → `node src/cli/index.js`.)

**2. Run the flow** — `add` → `list` → `sync` → `diff` → `extract`:

```
npx schema-snapshot add fixtures/v1.json -m "initial"           # normalize + commit first version
npx schema-snapshot add fixtures/v2.json -m "add status field"  # normalize + commit second version
npx schema-snapshot list                                        # see both versions
npx schema-snapshot sync                                        # push committed versions to schema-snapshots/ (host-repo-tracked, git-syncable)
npx schema-snapshot diff <id1> <id2>                            # structured diff between them
npx schema-snapshot extract <id1> <id2> --mode added            # pull out just the added/removed/modified entities
```

**3. What you get:**

- A per-entity `added`/`removed`/`modified` diff, not a raw JSON diff — a normalized view of the source that makes changes legible to a human or an AI agent.
- A durable, `list`/`show`-able version history, non-destructively removable (`remove --latest` is a git revert, never a delete).
- Cross-device history: `sync` writes to `schema-snapshots/`, a host-repo-tracked, git-syncable directory — no external DB or service needed.
- Partial extraction by mode (`added`/`removed`/`modified`) when you only need the delta, not the whole schema.

## Commands

`normalize`, `diff`, `add`, `list`, `show`, `get`, `remove`, `sync`, `status`, `extract` — one line each in [docs/cli-commands.md](./docs/cli-commands.md), full flags and examples there. `--help` on any command also works: `npx schema-snapshot <command> --help`.

## Customizable

Three pieces are swappable — only one option registered for each today, but the seam is there if you need another:

- **Store** (default: git, on disk) — where versions live. Swap for e.g. sqlite by implementing one interface.
- **Parser** (default: JSON files) — how input is read. Swap for e.g. YAML.
- **Normalizer** (default: Directus) — how raw schema becomes the diffable tree. Swap for another source system.

Details + how to add one: [docs/architecture.md](./docs/architecture.md#pluggable-points).

Structured this way on purpose — new backends/formats/sources are additive, not rewrites. Feature requests and PRs welcome.

## Status

**Implemented:** `normalize`, `diff`, `add`, `list`, `show`, `get`, `remove`, `extract`, `sync`, `status` — git-backed version storage (every version = one commit), host-repo-syncable event log (`schema-snapshots/`), CLI only.

**Not yet built:** rename detection, migrate-plan/apply, rollback plan, SQLite index, Web UI. See [Roadmap](./docs/roadmap-draft.md) for the ordered list — do not assume any of that exists in the code today.

## Versioning

Pre-`1.0.0`: no public API stability guarantee — internal module paths (`core/operations/*`, `core/env.js`, etc.) may move without a major bump. `1.0.0` will freeze a curated export surface (`src/index.js`) and the `EntityTree`/diff-view JSON shapes as the stable contract; changes to those after that point follow semver. See [CHANGELOG.md](./CHANGELOG.md).

## More docs

- [docs/architecture.md](./docs/architecture.md) — directory structure, flow, pluggable data structures (Normalizer/Parser/Store), configuration
- [docs/cli-commands.md](./docs/cli-commands.md) — full command reference
- [docs/roadmap-draft.md](./docs/roadmap-draft.md) — what's next, in order
- [CLAUDE.md](./CLAUDE.md) — AI agent onboarding: conventions, invariants, where to look first
