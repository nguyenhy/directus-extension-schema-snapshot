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
 * @param {{schemaType: string, storeDir: string, json?: boolean}} options
 */
async function cmdDiff(a, b, options) {
  const view = await diffSchemas({ a, b, schemaType: options.schemaType, storeDir: options.storeDir });

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    return;
  }
  printDiffView(view);
}

module.exports = { cmdDiff };
