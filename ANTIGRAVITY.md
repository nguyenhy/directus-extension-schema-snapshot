# ANTIGRAVITY.md

Antigravity agent-facing entry point. Read this first, then [docs/architecture.md](./docs/architecture.md) for structure/flow/pluggability details and [docs/cli-commands.md](./docs/cli-commands.md) for CLI flag specifications.

## What this repo is

CLI tool: normalizes a raw JSON schema export (Directus today) into a flat, diffable `EntityTree`, computes structured diffs between versions, extracts partial snapshots (added/removed/modified), and stores versions as git commits. See [README.md](./README.md) "What it is / What it's not" before assuming scope — no migration engine, no live sync, no data backfill.

## CodeGraph Navigation
This repository is indexed by CodeGraph (a `.codegraph/` directory exists at the root). 
- Always reach for CodeGraph tools (`codegraph explore "<symbol>"` or `codegraph node <symbol>`) BEFORE using grep, find, or reading random files. It is faster and retrieves exact verbatim symbols and callers.
- If running as an MCP client where CodeGraph tools are deferred/unloaded by default (e.g. Claude Code), load their schemas first — e.g. `ToolSearch("select:codegraph_explore,codegraph_node,codegraph_callers,codegraph_search")` — before falling back to `Read`/`cat`. Skipping this step is why agents default to `cat` instead of CodeGraph.

## Before touching code
1. **Flow Compliance**: Follow the 4-layer architecture strictly: `cli/commands` (parse argv) → `core/operations` (orchestrate) → `core/present` (build view-model) → `cli/render` (stdout format) (e.g. `add`, `diff`, `extract`). Keep pure logic in `core/` completely free of console formatting, `console.log`, or `process.exit`.
2. **Roadmap**: Review [docs/roadmap-draft.md](./docs/roadmap-draft.md) before building new capabilities to avoid scope creep or out-of-order development.
3. **EntityTree Keys**: Keys are flat `"kind:name"` string formats (e.g. `field:orders.status`). String splitting on `:` is done directly in multiple utility files; do not change the key format without updating all parser sites. Grep for `.indexOf(':')` and `.split(':')` before changing it.

## Conventions this codebase enforces
- **Dependency Injection**: Pass concrete objects like `store` and `parse` as arguments to `core/operations/` rather than importing them directly. `core/env.js` is the unique composition root.
- **Pluggable Registries**: Add new normalizers/parsers/stores by registering them under the registries in `core/normalizers/`, `core/parsers/`, and `core/env.js` (for stores) instead of writing string-matching conditional chains.
- **Error Handling**: Throw simple `Error` objects with clean message strings meant for the user. Do not leak raw stack traces or use `console.error` directly inside `core/`.
- **Non-Destructive Git Reverts**: `removeLatest()` performs a Git revert rather than destructive history rewriting (revert commit).
- **JSDoc over prose comments**: Every exported function in `core/` has a `@param`/`@returns` JSDoc block, often with a "GOTCHA:" or rationale paragraph explaining a non-obvious constraint (e.g. `diff.js`'s `deepEqual` relies on sorted keys, not structural equality). Read these before assuming behavior — they're accurate and current.
- **Prefix Conventions**: For `diff` and `extract` output:
  - `+` for added entities.
  - `-` for removed entities.
  - `~` for modified entities.

## Verifying a change
- Run unit tests and verify CLI command help:
  ```bash
  npm test              # node --test test/**/*.test.js — covers GitStore + the Store contract
  node src/cli/index.js <command> --help
  ```
  Note: Ensure all tests pass, including the reusable Store contract test in `test/store.contract.js`.

## Useful Customizations & Skills
- **antigravity-guide**: Refer to the builtin `antigravity-guide` skill (`/Users/hy/.gemini/antigravity/builtin/skills/antigravity_guide/SKILL.md`) for configuration/CLI questions about Antigravity.
- **Workspace Rules**: Any project-scoped constraints or rules for the agent should be defined under `.agents/AGENTS.md` in the workspace root.

## What NOT to assume
- Check [README.md](./README.md) "What it is / What it's not" before assuming scope.
- No database migration, live sync, or `export`/`import` commands (since `show --json` + `add` already round-trip versions).
- No rename detection — a field rename always shows as a separate remove + add in every diff view.
- Only one `Normalizer` (`directus`), one `Parser` (`json`), and one `Store` (`git`) are currently registered, despite the registries being built for more. Don't assume a second implementation exists just because the interface supports it.
