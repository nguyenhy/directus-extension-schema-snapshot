# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), semver from `1.0.0` onward (see README's "Versioning" section — pre-1.0 is not yet API-stable).

## [Unreleased]

## [0.3.0]

### Added
- `schema-snapshots/` sync layer (see [docs/proposal-schema-snapshot-sync.md](./docs/proposal-schema-snapshot-sync.md)): append-only `meta.json` event log + content-addressed `source/<hash>.json`, git-traceable and host-repo-syncable — replaces git-commit-hash identity (unstable across devices) with a deterministic content hash.
- `sync` command/op: rebuilds `.snapshot/repo` GitStore cache from scratch out of `meta.json`'s full event log (add + remove events), idempotent.
- `status` command/op: read-only comparison of `meta.json`'s current hash vs. the last `sync`'s recorded hash — no mutation.
- `remove --hash <hash>` / `remove --id <eventId>`: tombstone-based removal targeting any active event by content hash or explicit event id, independent of `remove --latest`.
- `remove --latest` now also appends a `remove` event to `meta.json` (previously GitStore-only) — safely repeatable as a toggle chain, and no longer silently resurrected by the next `sync`.
- Three id systems for `show`/`get`/`diff`/`extract`: event id (`e<N>`) and content hash (default, resolved via `meta.json`), cache-ref (raw GitStore commit sha, opt-in via `--cache-ref`) — deliberately not auto-detected between hash and cache-ref (same hex shape).
- `extract --snapshot`/`--snapshot-file`: reconstructs a full schema by overlaying an extracted delta onto an old tree, with merge verification (`verifyMerge`) before the result is trusted.

### Fixed
- `add`/`remove --latest` now stamp the GitStore commit message with the event id at commit time (not only during `sync`'s replay), so `list`/`resolveRef` see durable identity immediately instead of showing `-` until the next `sync`.

## [0.2.0]

### Fixed
- `package.json` `main` pointed at a nonexistent file (`src/core/normalize.js`); now points at `src/index.js`.

### Added
- `src/index.js` barrel now exports the full curated public API: `createEnv`, `normalizeSchema`, `buildMeta`, `diffSchemas`, `addVersion`, `listVersionsView`, `getVersionView`, `getRawSourceView`, `extractSchemas`, `buildExtractMeta`, `mergeIntoOld`, `verifyMerge`, `removeLatestVersion`, `removeSnapshotEvent`, `statusView`, `syncSnapshots`, `readSyncState`, `writeSyncState`, `entityKey`, `errors`.
- `package.json` `exports` map — blocks deep imports (`schema-snapshot/src/core/...`), root import only.
- README "Public API" section documenting the exported surface.
- `files`, `engines`, `repository`, `bugs`, `homepage` fields in `package.json`.
- Typed error classes (`src/core/errors.js`) for all `core/` failure paths — `SchemaSnapshotError` and subclasses replace plain `Error` throws, same message text.

Not yet frozen as a stable contract — that's the `1.0.0` gate (see README's "Versioning" section). `entityKey()`'s `"kind:name"` format may still change before then.

## [0.1.0]

Initial CLI: `normalize`, `diff`, `add`, `list`, `show`, `get`, `remove`, `extract`, `sync`, `status`.
