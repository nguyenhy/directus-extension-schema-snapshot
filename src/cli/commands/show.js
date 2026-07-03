const { createEnv } = require('../../core/env');
const { getVersionView } = require('../../core/operations/show');
const { resolveRef } = require('../../core/snapshotSync/resolve');
const { printShowView } = require('../render/show');

/**
 * commander action handler for `show <id>`.
 * Thin CLI glue: delegates to core/operations/show.js (reusable by a UI
 * backend too), then chooses whether to print or JSON-dump the view.
 *
 * Human output:
 *   - Collections: flat list
 *   - Fields: grouped by collection, system fields (id/dates/user_*) in separate block
 *   - Relations: grouped by collection, system relations in separate block
 * --json: the same derived view as JSON (for UI / programmatic use).
 *
 * `id` is an event id or content hash by default, resolved through
 * schema-snapshots/meta.json (see core/snapshotSync/resolve.js). Pass
 * `--cache-ref` to treat `id` as a raw GitStore commit sha instead
 * (debug/special-case — never auto-detected, see resolve.js's rationale).
 * @param {string} id - event id ("e3"), content hash, or (with --cache-ref) a commit SHA
 * @param {{storeDir: string, storeType: string, snapshotsDir: string, cacheRef?: boolean, json?: boolean}} options
 */
async function cmdShow(id, options) {
  const { store } = createEnv({ storeDir: options.storeDir, storeType: options.storeType });
  const resolvedId = options.cacheRef ? id : await resolveRef(id, { snapshotsDir: options.snapshotsDir, store });
  const view = await getVersionView({ id: resolvedId, store });

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    return;
  }

  printShowView(view);
}

module.exports = { cmdShow };
