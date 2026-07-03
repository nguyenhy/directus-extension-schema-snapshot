const { addVersion } = require('../../core/operations/add');
const { printAddView } = require('../render/add');

/**
 * commander action handler for `add <schema.json>`.
 * Thin CLI glue: delegates the actual normalize+commit+diff workflow to
 * core/operations/add.js (reusable by a UI backend too), then chooses
 * whether to print or JSON-dump the returned view.
 * @param {string} inputPath - schema.json argument from the CLI
 * @param {{schemaType: string, storeDir: string, message?: string, json?: boolean}} options - commander-parsed options
 */
async function cmdAdd(inputPath, options) {
  const view = await addVersion({
    inputPath,
    schemaType: options.schemaType,
    storeDir: options.storeDir,
    message: options.message,
  });

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    return;
  }
  printAddView(view);
}

module.exports = { cmdAdd };
