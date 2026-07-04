# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), semver from `1.0.0` onward (see README's "Versioning" section — pre-1.0 is not yet API-stable).

## [0.2.0]

### Added
- `src/index.js` barrel now exports the full curated public API: `createEnv`, `normalizeSchema`, `buildMeta`, `diffSchemas`, `addVersion`, `listVersionsView`, `getVersionView`, `getRawSourceView`, `extractSchemas`, `buildExtractMeta`, `mergeIntoOld`, `verifyMerge`, `removeLatestVersion`, `removeSnapshotEvent`, `statusView`, `syncSnapshots`, `readSyncState`, `writeSyncState`, `entityKey`, `errors`.
- `package.json` `exports` map — blocks deep imports (`schema-snapshot/src/core/...`), root import only.
- README "Public API" section documenting the exported surface.

Not yet frozen as a stable contract — that's the `1.0.0` gate (see README's "Versioning" section). `entityKey()`'s `"kind:name"` format may still change before then.

## [Unreleased]

### Fixed
- `package.json` `main` pointed at a nonexistent file (`src/core/normalize.js`); now points at `src/index.js`.

### Added
- `src/index.js` package entry point (currently exports `createEnv` only; curated public API surface lands in a later release).
- `files`, `engines`, `repository`, `bugs`, `homepage` fields in `package.json`.
- Typed error classes (`src/core/errors.js`) for all `core/` failure paths — `SchemaSnapshotError` and subclasses replace plain `Error` throws, same message text.

## [0.1.0]

Initial CLI: `normalize`, `diff`, `add`, `list`, `show`, `get`, `remove`, `extract`, `sync`, `status`.
