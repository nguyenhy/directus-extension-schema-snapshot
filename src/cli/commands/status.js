const { statusView } = require('../../core/operations/status');

/**
 * commander action handler for `status`.
 * Read-only — compares schema-snapshots/meta.json's current hash against
 * the last-synced hash. Never mutates (see core/operations/status.js).
 * @param {{storeDir: string, snapshotsDir: string, json?: boolean}} options
 */
async function cmdStatus(options) {
  const view = statusView({ snapshotsDir: options.snapshotsDir, storeDir: options.storeDir });

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    return;
  }
  if (view.inSync) {
    console.log(`In sync (${view.currentHash.slice(0, 7)})`);
  } else {
    const synced = view.syncedHash ? view.syncedHash.slice(0, 7) : '(never synced)';
    console.log(`Stale: current=${view.currentHash.slice(0, 7)} synced=${synced} — run \`sync\``);
  }
}

module.exports = { cmdStatus };
