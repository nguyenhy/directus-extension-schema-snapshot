const { createEnv } = require('../../core/env');
const { syncSnapshots } = require('../../core/operations/sync');

/**
 * commander action handler for `sync`.
 * Replays schema-snapshots/meta.json's active add events into the local
 * GitStore cache — idempotent, safe to rerun (see
 * core/operations/sync.js).
 * @param {{schemaType: string, storeDir: string, storeType: string, snapshotsDir: string, json?: boolean}} options
 */
async function cmdSync(options) {
  const { store } = createEnv({ storeDir: options.storeDir, storeType: options.storeType });
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
