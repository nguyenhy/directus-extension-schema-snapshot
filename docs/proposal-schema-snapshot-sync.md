- [Feature Proposal: Host-Repo Schema Snapshot Sync](#feature-proposal-host-repo-schema-snapshot-sync)
  - [1. Current Issue](#1-current-issue)
  - [2. Proposed Solution](#2-proposed-solution)
  - [3. Gaps](#3-gaps)
    - [3.1. Gap: Nested `.git` accidentally tracked](#31-gap-nested-git-accidentally-tracked)
    - [3.1. Gap: Cross-device hash mismatch](#31-gap-cross-device-hash-mismatch)
    - [3.2. Gap: No synchronization mechanism](#32-gap-no-synchronization-mechanism)
    - [3.3. Gap: Concurrent adds from multiple devices](#33-gap-concurrent-adds-from-multiple-devices)
    - [3.4. Gap: Remove targeting is ambiguous when the same hash is added multiple times](#34-gap-remove-targeting-is-ambiguous-when-the-same-hash-is-added-multiple-times)
    - [3.5. Gap: Existing GitStore API contract](#35-gap-existing-gitstore-api-contract)
    - [3.6. Gap: `remove` needs traceability without deleting data](#36-gap-remove-needs-traceability-without-deleting-data)
    - [3.7. Gap: Cache silently becomes stale](#37-gap-cache-silently-becomes-stale)
    - [3.8. Gap: No way to inspect synchronization state](#38-gap-no-way-to-inspect-synchronization-state)
    - [3.9. Gap: Auto vs manual synchronization preference](#39-gap-auto-vs-manual-synchronization-preference)
  - [4. Incremental Development Steps](#4-incremental-development-steps)

# Feature Proposal: Host-Repo Schema Snapshot Sync

## 1. Current Issue

- Tool store all schema history inside `.snapshot/repo`, own nested git repo (`GitStore`).
- `.snapshot/` suppose stay gitignored (local-only cache) but often get swallowed by host repo `git add .` — including inner `.git` — creating git-in-git mess, broken clone/push.
- Even if properly ignored: cross-device `list`/`get` don't work, cuz nothing sync `.snapshot` across machines.
- Even if synced via submodule: git commit hash inside `GitStore` differ per device (commit metadata like author/timestamp vary) → same schema version shows different id on different machines. `list` output not stable.
- Root cause: identity of a snapshot version tied to git-internal commit hash, not to content itself.

## 2. Proposed Solution

- Split "sync-able identity" from "local git engine."
- New tracked dir in host repo: `schema-snapshots/` (plain files, no nested `.git`, synced by host repo's normal git).
  ```
  schema-snapshots/
    meta.json          <- append-only event log, human-readable, git-traceable
    source/
      <contentHash>.json   <- raw source, content-addressed, immutable once written
  ```
- `contentHash` = sha256 of normalized source JSON — deterministic, same on every device.
- `meta.json` is an **event log**, not a mutable list. Each event has explicit `id`; `remove` events reference the exact `add` event by id, not by hash (avoids ambiguity when same hash is re-added after removal):
  ```json
  {
    "events": [
      {
        "id": "e1",
        "type": "add",
        "hash": "hash1",
        "at": "2026-07-01T10:00:00Z"
      },
      {
        "id": "e2",
        "type": "add",
        "hash": "hash2",
        "at": "2026-07-02T09:00:00Z"
      },
      {
        "id": "e3",
        "type": "remove",
        "removes": "e2",
        "at": "2026-07-03T11:00:00Z"
      }
    ]
  }
  ```
  Active set = all `add` events whose `id` is not referenced by any `remove.removes`. Removal never deletes `source/*.json` or rewrites prior events — non-destructive by construction, full trail via `git log -- schema-snapshots/meta.json`.
- `.snapshot/repo` GitStore stay local-only, rebuildable cache — used internally for diff engine, revert-safety, not for identity.
- `add`: write source under content hash, append `add` event (with new `id`) to `meta.json`, feed local GitStore for diff computation.
- `remove <hash>` (CLI-facing): resolve to the latest non-removed `add` event matching that hash, append `remove` event referencing its `id`. `--id <eventId>` flag available for explicit disambiguation when a hash was re-added.
- `list`/`get`: read from local `.snapshot/repo` cache (fast) — cache is kept honest via `sync`.
- `sync`: one-way propagation, replay `meta.json` event log into local `.snapshot/repo` GitStore, write `.snapshot/sync-state.json` marker (`syncedHash`) after.
- `status`: read-only, compares current `meta.json` hash vs `syncedHash` marker, reports in-sync / stale. No mutation.
- Auto/manual sync toggle: per-device config (`.snapshot/config.json`, gitignored) + `--sync=auto|manual` flag override; default manual.

## 3. Gaps

### 3.1. Gap: Nested `.git` accidentally tracked

**Why it happens**

No `.gitignore` rule ships by default.

**Fix**

- Ship a `.gitignore` entry for `.snapshot/` during init/install.
- Provide a one-time cleanup command:

```bash
git rm --cached -r .snapshot
```

**Why it works**

Prevents future accidental commits while allowing existing repositories to clean up once.

**Tradeoff**

Existing polluted repositories require a one-time migration.

---

### 3.1. Gap: Cross-device hash mismatch

**Why it happens**

Git commit hashes depend on:

- author
- timestamp
- parent commit

These vary across clones.

**Fix**

Use a deterministic content hash:

```text
SHA-256(normalized JSON)
```

as the public snapshot identity.

Git commit hashes remain an internal implementation detail.

**Why it works**

The hash becomes a pure function of snapshot content.

**Tradeoff**

Hashing must be fully deterministic.

JSON normalization must:

- sort object keys
- serialize consistently

This is the same requirement already present in `diff.js`'s deep equality logic.

---

### 3.2. Gap: No synchronization mechanism

**Why it happens**

`.snapshot/` was designed as a local cache.

No synchronization command currently exists.

**Fix**

Introduce:

```text
schema-snapshots/
```

plus a `sync` command that rebuilds the local GitStore from the event log.

**Why it works**

The host repository's Git already synchronizes source code.

Schema history simply piggybacks on that existing channel.

**Tradeoff**

The local GitStore can drift or become corrupted.

Therefore:

- `sync` must be idempotent
- rebuilding from scratch must always be possible

---

### 3.3. Gap: Concurrent adds from multiple devices

**Why it happens**

Two devices may append to `meta.json` before pulling each other's changes.

**Fix**

Use an append-only event log and rely on normal Git merge workflows.

**Why it works**

The data format is simple enough to resolve manually without custom tooling.

**Tradeoff**

Conflicts remain manual.

To reduce conflict frequency, consider using JSON Lines instead of a JSON array.

---

### 3.4. Gap: Remove targeting is ambiguous when the same hash is added multiple times

**Why it happens**

Removing by content hash alone cannot distinguish which `add` event should be undone.

**Fix**

Store remove events using the target event ID:

```json
{
  "type": "remove",
  "removes": "<eventId>"
}
```

rather than the content hash.

The CLI resolves:

```text
remove <hash>
```

to the latest non-removed matching event by default.

An explicit escape hatch is also available:

```text
remove --id <eventId>
```

**Why it works**

Each `add` event has a unique ID.

Removal always targets exactly one historical event.

**Tradeoff**

The CLI must resolve hashes into event IDs before writing the remove event.

---

### 3.5. Gap: Existing GitStore API contract

**Why it happens**

The Store abstraction currently assumes GitStore is the source of truth.

Examples include:

- Store interface
- `removeLatest()` implemented via Git revert

**Fix**

Keep GitStore unchanged.

Only change its role:

- internal cache
- local implementation
- no longer distributed state

**Why it works**

Existing Store contract tests continue passing.

`.snapshot/repo` still satisfies the Store interface.

**Tradeoff**

A synchronization layer now sits above the Store abstraction.

---

### 3.6. Gap: `remove` needs traceability without deleting data

**Why it happens**

Content-addressed snapshot files may still be referenced by history or rollback operations.

**Fix**

`remove` appends a tombstone event only.

Never delete:

```text
source/<hash>.json
```

**Why it works**

Preserves complete history.

Supports rollback and auditability.

History remains visible through:

```bash
git log -- schema-snapshots/meta.json
```

**Tradeoff**

The `source/` directory grows indefinitely.

Given the small size of JSON snapshots, this is considered acceptable.

---

### 3.7. Gap: Cache silently becomes stale

**Why it happens**

`list` and `get` read the local cache without detecting changes to `meta.json`.

Examples:

- `git pull`
- `git checkout`
- manual edits

**Fix**

Store the latest synchronized metadata hash in:

```text
.snapshot/sync-state.json
```

Compare this value with the current `meta.json` hash before reads.

**Why it works**

Hash comparison is inexpensive.

A full replay only occurs when synchronization is actually required.

**Tradeoff**

An additional state file must be kept consistent.

---

### 3.8. Gap: No way to inspect synchronization state

**Why it happens**

Only `sync` exists today, and it mutates local state.

**Fix**

Introduce a read-only:

```text
status
```

command.

**Why it works**

Safe to execute at any time.

Allows users to check synchronization state without modifying anything.

**Tradeoff**

Adds another CLI command.

---

### 3.9. Gap: Auto vs manual synchronization preference

**Why it happens**

Different users prefer different synchronization workflows.

**Fix**

Store a per-device configuration in:

```text
.snapshot/config.json
```

Support CLI overrides:

```text
--sync=auto
--sync=manual
```

Default:

```text
manual
```

**Why it works**

Synchronization becomes a user preference rather than a project-wide policy.

**Tradeoff**

Preferences may differ across devices, making consistent behavior dependent on local configuration.

## 4. Incremental Development Steps

1. **Guard rail first (low risk):** add `.snapshot/` to `.gitignore` template + doc; write cleanup snippet (`git rm --cached`) for already-polluted repos. Ship immediately, unblock current mess.
2. **Content hash utility:** add deterministic hash fn (sorted-key JSON → sha256) in `core/`, JSDoc'd, unit test against known input → stable hash.
3. **`meta.json` + `source/` schema:** define event-log shape (with `id`/`removes`), write/read + fold-to-active helpers in `core/operations`, following registry/injected-store convention.
4. **Wire `add`:** extend existing `add` op to also write `schema-snapshots/source/<hash>.json` + append `add` event (with new `id`) to `meta.json`, alongside existing GitStore commit (dual-write, don't remove GitStore).
5. **Repoint `list`/`get`:** switch read path to `.snapshot/repo` cache (unchanged reads), confirm hash stability across devices manually (2 clones, same `add`, compare hash).
6. **`remove <hash>` / `remove --id <id>`:** resolve hash → latest non-removed matching event id (default), or explicit `--id`; append `remove` event referencing that id only. Verify `source/*.json` untouched, verify `git log -- meta.json` shows full trail.
7. **`sync` op + command:** replay `meta.json` event log into local `.snapshot/repo`; idempotent, safe to rerun.
   - 7a. Write `.snapshot/sync-state.json` (`syncedHash`) on `sync` completion.
   - 7b. Add `status` command — hash compare only, no mutation.
   - 7c. Add auto/manual toggle (`.snapshot/config.json` + `--sync` flag), wire pre-check into `list`/`get`.
8. **Contract test:** extend `test/store.contract.js`-style test to cover event-log fold (incl. `id`/`removes` resolution), sync idempotency, non-destructive `remove`.
9. **Docs:** update `docs/architecture.md` + `docs/cli-commands.md`, describe dual-storage model (meta.json truth vs GitStore cache) and new `sync`/`status`/`remove` commands.

## 5. Implementation Reality Check (post-hoc, written against the actual code on `fix/snapshot-sync`)

This section exists because step 3 (`sync`) was implemented once as designed, produced a real bug in manual testing, and was corrected to a different mechanism than §2/§3.2 describe. Anyone reading this proposal as a spec for the current code needs these corrections; anyone extending the code needs the trade-offs below, none of which are written elsewhere.

### 5.1. What the plan got wrong

- **§2/§3.2 "`sync`: replay meta.json into local GitStore" (incremental) is not what's implemented.** First implementation *was* incremental — track synced event ids in `sync-state.json`, only commit new ones. It reproduced exactly the bug §1 exists to fix: `add` already commits directly into GitStore *and* writes the event; `sync` then saw that event as "unsynced" (nothing recorded it) and re-committed it, doubling every version in `list`. Real fix (`core/operations/sync.js`'s `syncSnapshots`): **`sync` wipes `storeDir` entirely (`wipeStore()` — `rm -rf` + recreate + `git init`) and replays every active event from scratch, every time.** Not incremental, not additive. `sync-state.json` now stores only `{ syncedHash }` (the whole log's content hash, for `status` to compare against) — the `syncedEventIds` array from the first attempt is gone.
- **§3.7 "cache silently becomes stale" fix undersells what "sync" now means.** The proposal frames staleness as a read-time problem solved by a hash comparison gate. In the shipped code, `sync` *is* the rebuild — there's no partial catch-up path. `status` (§3.8) is correctly read-only, but there is no "only replay what changed" — every `sync` call is a full teardown/rebuild of `.snapshot/repo`.
- **§4 step 5 "repoint list/get to `.snapshot/repo` cache (unchanged reads)" undersold the actual scope.** `list`/`get`/`show`/`diff`/`extract` all needed new argument-resolution logic, not just a read-path repoint (see 5.2 below) — this was discovered only after manual testing showed raw GitStore commit shas as the primary `list` output were unusable (unstable across every `sync`, and format-identical to content hashes, so nothing could safely auto-detect which was which).
- **§4 step 7c ("wire pre-check into `list`/`get`") was not built.** `list`/`get`/`show`/`diff`/`extract` never auto-sync or auto-check staleness — the user must run `sync` manually before an event/hash ref will resolve. See 5.2's resolver note.
- **§3.9's auto/manual toggle (`.snapshot/config.json`, `--sync=auto|manual`) was not built at all.** Deferred, no code exists for it.

### 5.2. Implementation notes and trade-offs not visible in code comments

- **Three id systems now exist, not the two §2 describes (`hash` vs "git-internal commit hash"):** event id (`e<N>`, from `meta.json`), content hash (sha256, from `meta.json`), and cache-ref (GitStore commit sha, from `.snapshot/repo`). Event id/hash are the default, unflagged surface for `show`/`get`/`diff`/`extract`; cache-ref requires an explicit `--cache-ref` flag on those same commands. This is deliberate, not an oversight: a short content hash and a short git sha are the same hex shape, so silently auto-detecting between them would be ambiguous by construction (`core/snapshotSync/resolve.js`'s doc comment covers the "why," this covers the "why it wasn't in the original plan" — it only became visible once `list`'s default output was tested against a real multi-hundred-entity snapshot).
- **Resolution from event id/hash to a usable GitStore commit id depends entirely on a string convention with no schema behind it.** `core/operations/sync.js`'s `syncSnapshots()` writes each replayed commit's message as `sync: <eventId> (<hash7>)`; `core/snapshotSync/eventLog.js`'s `parseSyncMessage()` (shared by `present/list.js` and `resolve.js`) is the only place that string is parsed back apart. If a commit's message doesn't match that exact regex — e.g. a version committed via `add` before dual-write existed, or `remove --latest`'s revert commits — `list` shows `event`/`hash` as `"-"` and `resolveRef()` cannot find it at all. There is no fallback path other than `--cache-ref`.
- **`remove --latest` and `remove --hash`/`--id` are two independent mechanisms that do not know about each other, and can silently undo one another.** `--latest` reverts the local GitStore directly (`GitStore.removeLatest()`, unchanged from before this feature) and never touches `meta.json`. `--hash`/`--id` appends a tombstone to `meta.json` and never touches GitStore directly. Consequence: running `remove --latest` "removes" a version only until the next `sync`, which wipes `.snapshot/repo` and rebuilds it purely from `meta.json`'s active events — silently reinstating whatever `--latest` just reverted, with no warning. `--latest` is effectively local-cache-only and non-durable once `schema-snapshots/` dual-write is in use; this is not stated anywhere in the CLI help text or command docs.
- **`sync` is a destructive operation on `.snapshot/repo`, framed as safe because that directory is "disposable."** `wipeStore()` does an unconditional `fs.rmSync(storeDir, { recursive: true, force: true })`. That's correct under the "GitStore is a rebuildable cache" model this proposal established (§2), but it means any local GitStore state not represented in `meta.json` — e.g. a commit from `add` run without `--snapshots-dir` — is lost on the next `sync`, with no confirmation prompt (unlike `remove --latest`, which does prompt). Acceptable given the model, but a real footgun if `add` and `sync` are mixed inconsistently across a session.
- **`addVersion()`'s dual-write (`core/operations/add.js`) is opt-in via a `snapshotsDir` param, not a flag flip on the Store.** Omitting `snapshotsDir` reproduces pre-feature behavior exactly (GitStore-only, no `meta.json` write) — this was a deliberate compatibility decision so `test/add.test.js` didn't need updating in Phase 1, not something the proposal anticipated needing.
- **Content hash length was raised as a real usability complaint, not just theoretical.** Full sha256 hex (64 chars) is written to `meta.json` (required — truncating the stored identity would reintroduce collision risk this feature exists to avoid). What changed in response: no CLI output ever prints the full hash by default — `list`, `sync`, `status`, and `resolveRef()`'s error messages all truncate to 7 chars, matching git's own short-sha convention. The full hash is only visible by reading `meta.json` directly or passing `--json`.