const { createEnv } = require('../../core/env');
const { syncSnapshots } = require('../../core/operations/sync');

/**
 * commander action handler for `sync`.
 * Replays schema-snapshots/meta.json's active add events into the local
 * GitStore cache — idempotent, safe to rerun (see
 * core/operations/sync.js).
 *
 * `sync` unconditionally wipes `--store-dir` first (see syncSnapshots'
 * store.reset()) — any local-only commit not yet reflected in
 * `schema-snapshots/meta.json` (e.g. an `add`/`remove --latest` run with a
 * stale/different --snapshots-dir) is discarded, not migrated. If the store
 * already has history, this prints how many commits are about to be
 * dropped so that's visible before the wipe, not just after.
 * @param {{schemaType: string, storeDir: string, storeType: string, snapshotsDir: string, json?: boolean}} options
 */
async function cmdSync(options) {
  const { store } = createEnv({ storeDir: options.storeDir, storeType: options.storeType });

  const existing = await store.list();
  if (existing.length > 0 && !options.json) {
    console.log(`Discarding ${existing.length} local commit(s) in ${options.storeDir} and rebuilding from ${options.snapshotsDir}...`);
  }

  const result = await syncSnapshots({
    snapshotsDir: options.snapshotsDir,
    schemaType: options.schemaType,
    store,
    storeDir: options.storeDir,
  });

  if (options.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }
  console.log(`Synced ${result.syncedCount} event(s). syncedHash=${result.syncedHash.slice(0, 7)}`);
}

module.exports = { cmdSync };
