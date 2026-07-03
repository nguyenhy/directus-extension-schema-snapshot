# CLAUDE.md

Agent-facing entry point. Read this first, then [docs/architecture.md](./docs/architecture.md) for structure/flow/pluggability detail and [docs/cli-commands.md](./docs/cli-commands.md) for exact flags.

## What this repo is

CLI tool: normalizes a raw JSON schema export (Directus today) into a flat, diffable `EntityTree`, computes structured diffs between versions, extracts partial snapshots (added/removed/modified), and stores versions as git commits. See [README.md](./README.md) "What it is / What it's not" before assuming scope — no migration engine, no live sync, no data backfill.

## Before touching code

1. Read [docs/architecture.md](./docs/architecture.md) "Flow" section — every command is `cli/commands` (parse argv) → `core/operations` (orchestrate) → `core/present` (build view) → `cli/render` (print). Don't collapse these layers or put console.log/process.exit in `core/` (e.g. `add`, `diff`, `extract`).
2. Check `docs/roadmap-draft.md` before assuming something is missing or unscoped — it lists what's deliberately not built yet (rename detection, migrate-plan/apply, Web UI) vs. what's done.
3. `EntityTree` keys are `"kind:name"` strings, parsed by string-split in multiple places (`fsTree.js`, `buildMeta()`) — not a shared parser. Changing the format in `core/directus/normalize.js`'s `entityKey()` silently breaks those call sites with no compile error. Grep for `.indexOf(':')` and `.split(':')` before changing it.

## Conventions this codebase already enforces — follow them

- **Injected dependencies, not imports.** `core/operations/*.js` never does `new GitStore(...)` or `require('../parsers')` directly — `store` and `parse` are passed in as params, constructed once in `core/env.js`'s `createEnv()`. If you add a new operation, follow the same pattern; don't hardcode a concrete Store/Parser inside `core/`.
- **Registries over switch-on-string-scattered-everywhere.** `core/normalizers/index.js` and `core/parsers/index.js` are the pattern: a plain object map + a `getX(type)` lookup that throws a clear `Unknown X "y". Available: ...` error. Follow this shape for any new pluggable type instead of an if/else chain.
- **Errors are clean, not raw stacks.** Every user-facing failure (missing file, unknown type, bad id) throws a plain `Error` with a message meant to be printed as `Error: <message>` — caught centrally in `cli/index.js`. Don't `console.error(err)` a raw stack from inside `core/` or `cli/commands/`.
- **Non-destructive by construction.** `GitStore.removeLatest()` is a `git revert`, never `reset --hard` or history rewrite — every prior version stays readable afterward. If you extend removal (e.g. `remove <id>`), preserve this invariant; it's load-bearing for the "safe schema versioning" pitch, not incidental.
- **JSDoc over prose comments.** Every exported function in `core/` has a `@param`/`@returns` JSDoc block, often with a "GOTCHA:" or rationale paragraph explaining a non-obvious constraint (e.g. `diff.js`'s `deepEqual` relies on sorted keys, not structural equality). Read these before assuming behavior — they're accurate and current, unlike stale prose docs tend to become.

## Verifying a change

```
npm test              # node --test test/**/*.test.js — covers GitStore + the Store contract
node src/cli/index.js <command> --help
```

`test/store.contract.js` is a reusable contract test — any new `Store` implementation must pass it, not just `GitStore`-specific tests.

## Skills / agents useful in this repo

- **Codebase Onboarding Engineer** — points here + `docs/architecture.md` first; both are written to be sufficient without re-reading every source file.
- `ecc:code-review` / `code-review` skill — review diffs before commit; this repo's JSDoc-contract style means a reviewing agent should check new code documents its contract the same way, not just that it works.
- CodeGraph (`.codegraph/` present in this repo) — prefer `codegraph_explore`/`codegraph node` over grep for tracing a symbol's callers (e.g. "who calls `GitStore.set`") before editing `core/store/`.

## What NOT to assume

- No `export`/`import` commands — `show --json` + `add` already round-trip a version if you need that.
- No rename detection — a field rename always shows as a separate remove + add in every diff view.
- Only one `Normalizer` (`directus`), one `Parser` (`json`), one `Store` (`git`) registered today, despite the registries being built for more. Don't assume a second implementation exists just because the interface supports it.
