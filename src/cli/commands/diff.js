const { createEnv } = require('../../core/env');
const { diffSchemas } = require('../../core/operations/diff');
const { printDiffView } = require('../render/diff');

/**
 * commander action handler for `diff <a> <b>`.
 * Thin CLI glue: delegates to core/operations/diff.js (reusable by a UI
 * backend too — same file-vs-version auto-detection there), then chooses
 * whether to print or JSON-dump the view.
 *
 * @param {string} a
 * @param {string} b
 * @param {{schemaType: string, storeDir: string, storeType: string, fileFormat: string, json?: boolean}} options
 */
async function cmdDiff(a, b, options) {
  const { store, parse } = createEnv({ storeDir: options.storeDir, storeType: options.storeType, fileFormat: options.fileFormat });
  const view = await diffSchemas({ a, b, schemaType: options.schemaType, store, parse });

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    return;
  }
  printDiffView(view);
}

module.exports = { cmdDiff };
