const { createEnv } = require('../../core/env');
const { diffSchemas } = require('../../core/operations/diff');
const { resolveArgOrFile } = require('../../core/snapshotSync/resolve');
const { printDiffView } = require('../render/diff');

/**
 * commander action handler for `diff <a> <b>`.
 * Thin CLI glue: delegates to core/operations/diff.js (reusable by a UI
 * backend too — same file-vs-version auto-detection there), then chooses
 * whether to print or JSON-dump the view.
 *
 * Non-file args are event ids or content hashes by default, resolved
 * through schema-snapshots/meta.json (see core/snapshotSync/resolve.js).
 * Pass `--cache-ref` to treat non-file args as raw GitStore commit shas
 * instead — applies to both `a` and `b` uniformly.
 * @param {string} a
 * @param {string} b
 * @param {{schemaType: string, storeDir: string, storeType: string, fileFormat: string, snapshotsDir: string, cacheRef?: boolean, json?: boolean}} options
 */
async function cmdDiff(a, b, options) {
  const { store, parse } = createEnv({ storeDir: options.storeDir, storeType: options.storeType, fileFormat: options.fileFormat });

  // Fetch store.list() once and share it — resolveArgOrFile/resolveRef
  // would otherwise each call it independently, doubling the git-log read
  // for a two-arg command like this one.
  const versions = options.cacheRef ? undefined : await store.list();
  const resolveOpts = { snapshotsDir: options.snapshotsDir, store, cacheRef: options.cacheRef, versions };
  const [resolvedA, resolvedB] = await Promise.all([resolveArgOrFile(a, resolveOpts), resolveArgOrFile(b, resolveOpts)]);

  const view = await diffSchemas({ a: resolvedA, b: resolvedB, schemaType: options.schemaType, store, parse });

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    return;
  }
  printDiffView(view);
}

module.exports = { cmdDiff };
