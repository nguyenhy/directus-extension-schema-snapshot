const fs = require('fs');
const { createEnv } = require('../../core/env');
const { getRawSourceView } = require('../../core/operations/get');
const { resolveRef } = require('../../core/snapshotSync/resolve');
const { printGetView } = require('../render/get');

/**
 * commander action handler for `get <id>`.
 * Thin CLI glue: delegates to core/operations/get.js (reusable by a UI
 * backend too), then chooses whether to write a file, JSON-dump, or
 * pretty-print the view.
 *
 * `id` is an event id or content hash by default, resolved through
 * schema-snapshots/meta.json (see core/snapshotSync/resolve.js). Pass
 * `--cache-ref` to treat `id` as a raw GitStore commit sha instead.
 * @param {string} id - event id ("e3"), content hash, or (with --cache-ref) a commit SHA
 * @param {{storeDir: string, storeType: string, snapshotsDir: string, cacheRef?: boolean, outFile?: string, json?: boolean}} options
 */
async function cmdGet(id, options) {
  const { store } = createEnv({ storeDir: options.storeDir, storeType: options.storeType });
  const resolvedId = options.cacheRef ? id : await resolveRef(id, { snapshotsDir: options.snapshotsDir, store });
  const view = await getRawSourceView({ id: resolvedId, store });

  if (options.outFile) {
    fs.writeFileSync(options.outFile, JSON.stringify(view.raw, null, 2));
    console.log(`Wrote ${options.outFile}`);
    return;
  }

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    return;
  }

  printGetView(view);
}

module.exports = { cmdGet };
