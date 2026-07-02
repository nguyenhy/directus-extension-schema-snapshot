# Roadmap

Ordered, each stage builds on the last. Only stage 1 (`normalize` + `diff`, CLI-only, no storage) is built — see [architecture.md](./architecture.md) and [cli-commands.md](./cli-commands.md) for current behavior.

1. **Storage, backend-agnostic** — a `Store` interface (`get`/`set`/`list`/`update`/`delete`) so versions can be persisted to a flat file, git commits, sqlite, or anything else, swappable without touching the CLI or `normalize`/`diff`. Adds `add` (store new version + auto-diff vs. prior), `list`/`log`, `show <ver>`, `export`/`import`.
2. **Rename detection** — `renamed_candidates` in diff output: heuristic match on type + position, always flagged for human confirmation before being treated as a rename (prevents silently turning a rename into a destructive remove+add).
3. **Extract** — generate a partial snapshot containing only added or only removed fields, usable as isolated migration units.
4. **Migrate plan** — turn a diff into an ordered list of operations (collections → fields → relations for adds; reverse for removes), safe against FK ordering.
5. **Apply** — execute a migration plan against a live schema via SDK calls (Directus extension entrypoint). Add-phase and remove-phase run as separate, explicit steps so manual backfill can happen in between. Dry-run mode (print planned calls, no execution) built in from the start, not bolted on later.
6. **Rollback plan generator** — reverse-diff from an applied migration.
7. **SQLite index** — fast query/join layer derived from the stored versions, for agent/AI querying.
8. **Web UI** — reuses the same core lib as the CLI; renders `renamed_candidates` confirmation and diff review visually instead of via CLI prompts.
9. ~~**Pluggable normalizer**~~ — done. `core/normalizers/index.js` registry + `Normalizer` contract, `--schema-type` flag (default `directus`, env fallback `SCHEMA_SNAPSHOT_TYPE`). `directus` is still the only registered implementation — a second one (e.g. generic JSON) is future work, but adding it now only means writing+registering a new module, no other file changes. See [architecture.md](./architecture.md#normalizers).
