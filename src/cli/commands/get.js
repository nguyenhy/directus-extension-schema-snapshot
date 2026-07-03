const fs = require('fs');
const { createEnv } = require('../../core/env');
const { getRawSourceView } = require('../../core/operations/get');
const { printGetView } = require('../render/get');

/**
 * commander action handler for `get <id>`.
 * Thin CLI glue: delegates to core/operations/get.js (reusable by a UI
 * backend too), then chooses whether to write a file, JSON-dump, or
 * pretty-print the view.
 * @param {string} id - commit SHA (full or short prefix from `list`)
 * @param {{storeDir: string, storeType: string, outFile?: string, json?: boolean}} options
 */
async function cmdGet(id, options) {
  const { store } = createEnv({ storeDir: options.storeDir, storeType: options.storeType });
  const view = await getRawSourceView({ id, store });

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
