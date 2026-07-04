## [1.0.4](https://github.com/nguyenhy/directus-extension-schema-snapshot/compare/v1.0.3...v1.0.4) (2026-07-04)


### Bug Fixes

* remove comment from tsconfig to make it comaptible with parser ([39b58a5](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/39b58a5e68f0ee34ba5e4b8f44f130f345fbd69a))

## [1.0.3](https://github.com/nguyenhy/directus-extension-schema-snapshot/compare/v1.0.2...v1.0.3) (2026-07-04)


### Bug Fixes

* add `revert`, `refactor` to the commit-analyzer ([53d5058](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/53d5058f111b62bea55f00dd9bb9e144710dde3a))

## [1.0.2](https://github.com/nguyenhy/directus-extension-schema-snapshot/compare/v1.0.1...v1.0.2) (2026-07-04)


### Bug Fixes

* add id-token permission for npm trusted publishing ([dafbd87](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/dafbd87feac8d6ead3801cd7bd1149b877ffe4b6))
* scope release job to github environment for npm oidc trust ([4aab61a](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/4aab61a534d633516205b51d67fb4fbef26798dc))

## [1.0.1](https://github.com/nguyenhy/directus-extension-schema-snapshot/compare/v1.0.0...v1.0.1) (2026-07-04)


### Bug Fixes

* correct bin path with `npm pkg fix` ([8aff5d5](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/8aff5d50f9f0c63271775af4817a462b492fffc0))
* correct package-lock after use node 22 to install ([8e13315](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/8e133150dbc20623ac99425ba9504d1ac89fba36))
* src/cli/index.js not executable ([9f57956](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/9f5795681a37eb1e0062f2be5f11eda6188f566d))

# 1.0.0 (2026-07-04)


### Bug Fixes

* add optional denormalize to Normalizer typedef ([e438477](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/e438477ee2d323fe073a97f3de7b8a78839b0b7a))
* add verification field to extractSchemas return-type JSDoc ([5c4267e](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/5c4267e9b621564504972a27319d94f3cc6b4b3b))
* correct behavior of `sync` with `add`, `remove`, `list` ([c53b68e](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/c53b68e53945e8540f9be70a1dea91056019ea3b))
* correct change log v0.2.0 ([794fd28](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/794fd28725897723ebd5c4b8dfdec8f0e756b770))
* correct doc drift, dedupe meta builders, guard remove/sync edge cases ([fcdbb33](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/fcdbb339a959ae9d44c362ff4b90977b45cc89d8))
* correct package.json main entry, add npm metadata ([a2344b5](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/a2344b570feb8e8ec47b2722f8646d7424afdfec))
* ensure `add` add correct message to the store and handling custom message ([3453023](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/3453023dfe717367a04f6bbd72109b9660713666))
* improve the performance of `show` and `diff` ([c962d33](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/c962d33d2fae7aec1d77c50e8796abda56e88f17))
* permission issue during release workflow ([0796c6a](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/0796c6a2f92de530f52dee1d5f2ced48f413b2f5))
* prefix printing of `extract` command ([b6090d1](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/b6090d10e41e948bfa7f640eaed9d1cf030829bb))
* type collections accumulator as string index signature ([53d6323](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/53d63232182329123e9dd16bd83557b46c0ccadb))
* type entityKey loop array as union tuple, not widened string[] ([7dca554](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/7dca554177787adf03eada4e7644034eda227f2a))
* type eventAtById as string index signature, not bare object literal ([033e618](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/033e618e92d3271af39b1af3661343f639fd00d8))
* update node version ([d95fa27](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/d95fa2793ccc6a165c114e17a72269d10facaae5))
* use simple-git's named export, callable per its type declarations ([4acdef5](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/4acdef5e5eb3896cf2d1f1fab1c4b046d50606c4))
* **workflow:** config identity for gitstore during test ([34ad510](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/34ad510454717d0440f63fdacd11418c67b1d7c7))


### Features

* `add` with git store ([dea7650](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/dea76508c21bc1db87d3b18ca35bb477776ad280))
* add `--snapshot` to `extract` ([3828c68](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/3828c68eb5d6d1290b8ff17e6bda01120ee3df91))
* add `diff` command ([3edf252](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/3edf2520746a479b66837d6acb3f484ecc3ce6d4))
* add `extract` command ([cf418f2](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/cf418f20fb2ad00ba271e31dc70ec3fb533dedc6))
* add `get` command ([d8475ee](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/d8475eee68aaaedb775431683b9ffd8f88702aed))
* add `list` command ([52b3e99](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/52b3e992309e3aa260f768b43715f0202e2fd4c6))
* add `remove` command ([fa55fcd](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/fa55fcd8e0de4924fb44ae13ee52bb7605ecddd3))
* add `show` command ([1546603](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/15466035f99aead75399cd8d0efddf72f5405b8c))
* add `sync` command ([4b37e77](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/4b37e77199106fa3155f1b59b9648bdcf8b6023b))
* add commander-based CLI with normalize and diff commands ([3de5c11](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/3de5c114d6f6c5373b6ca283b2aa80dc876c1b0c))
* add core normalize/diff lib with pluggable normalizer registry ([99cd068](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/99cd068e1181e588a2e573bb4623922c506779be))
* add correct and add new test ([685a547](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/685a547fe7b02fd4baaa395741f6933565cc85eb))
* add MIT license ([efa2681](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/efa26811a25a1b9bc6393c535558d43cb1b9bc37))
* add mode `modified` ([b45f121](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/b45f12199398cc02ac86ace2627c840fdebf603d))
* add package.json exports map, block deep imports ([40996be](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/40996be3c5d4e51bccbfb303589486fd152c7de9))
* add test for core `diff` and `normalizer` ([79492b1](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/79492b1497a10d0487096fae1b1594c9d81311ae))
* add typed error classes for core/ failure paths ([a1afafb](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/a1afafbbf1d740b608d888015f8767ff82ae85c2))
* expand index.js barrel with curated public API exports ([c1536af](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/c1536af8924877e1b8bf4b986d0c0b844f4aecbb))
* generate .d.ts from JSDoc via tsc, add type-check CI script ([f4bf01c](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/f4bf01cce9719bbf5eb8a99d89c7fe71f062af17))
* make normalize's subdir naming configurable via template ([91ed969](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/91ed969b9b8a541e0aa1cb666d9d36df64ce1e50))
* separate the core operation from cli command ([6794695](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/67946954aab03137fae1c7b4b18e1fa51aaebe5e))
* split list's timestamp into explicit commitTimestamp/eventTimestamp ([11a065c](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/11a065ce331e5ca5299a1612799f7733e05abd4e))
* update agent tooling notes ([4cfc058](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/4cfc0588bf4c54c370f7f8df64b5b3ee195d9da8))
* update cli render format ([e863c26](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/e863c26b040a0b24058e8a24e3f8a9b97992c7dc))
* update doc for `extract` ([ea4750e](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/ea4750e426335a073c80d826637c6c479ef32878))
* update new changes an the behavior ([6cd1e09](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/6cd1e09e5bb315024f833f8cb4a67db14d73d298))
* update testing workflow ([f70b988](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/f70b9882d90726fb728ca423b5be13fcf17d2ae2))
* update v0.3.0 change log ([204f6dd](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/204f6dd333f58c3ac30eb84291921d0b5617d52d))
* use `actions/checkout@v7` and `actions/setup-node@v5` ([6c8cefe](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/6c8cefe7db3f00318a432b68a4d1ce7eb12962e2))
* use semantic release ([58c6242](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/58c6242ca185226985f8170b9a18cb942f20f3fd))
* wire types:build into prepack now that tsc exits clean ([3dfab3f](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/3dfab3f9675a9fb1353356761b450e204ddc1293))
* **workflow:** update files that trigger test workflow ([8ebfec3](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/8ebfec3048697b3c888915dd718859cc5ee2df9c))


### Performance Improvements

* write only changed entity files on GitStore.set ([97e4e4c](https://github.com/nguyenhy/directus-extension-schema-snapshot/commit/97e4e4c741939bf9bb4921bbabf6680717f0b867))

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
