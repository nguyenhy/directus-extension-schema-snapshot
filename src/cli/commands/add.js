const { createEnv } = require('../../core/env');
const { addVersion } = require('../../core/operations/add');
const { printAddView } = require('../render/add');

/**
 * commander action handler for `add <schema.json>`.
 * Thin CLI glue: delegates the actual normalize+commit+diff workflow to
 * core/operations/add.js (reusable by a UI backend too), then chooses
 * whether to print or JSON-dump the returned view.
 * @param {string} inputPath - schema.json argument from the CLI
 * @param {{schemaType: string, storeDir: string, storeType: string, fileFormat: string, message?: string, json?: boolean}} options - commander-parsed options
 */
async function cmdAdd(inputPath, options) {
  const { store, parse } = createEnv({ storeDir: options.storeDir, storeType: options.storeType, fileFormat: options.fileFormat });
  const view = await addVersion({
    inputPath,
    schemaType: options.schemaType,
    message: options.message,
    store,
    parse,
  });

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    return;
  }
  printAddView(view);
}

module.exports = { cmdAdd };
