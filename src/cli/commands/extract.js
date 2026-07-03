const { createEnv } = require('../../core/env');
const { extractSchemas } = require('../../core/operations/extract');
const { printExtractView } = require('../render/extract');

/**
 * commander action handler for `extract <old> <new>`.
 * Thin CLI glue: delegates to core/operations/extract.js (reusable by a UI
 * backend too — same file-vs-version auto-detection as `diff`), then
 * chooses whether to print or JSON-dump the view.
 * @param {string} oldSchema
 * @param {string} newSchema
 * @param {{mode: 'added'|'removed', schemaType: string, storeDir: string, storeType: string, fileFormat: string, outDir: string, subdirFormat: string, dryRun?: boolean, json?: boolean}} options
 */
async function cmdExtract(oldSchema, newSchema, options) {
  const { store, parse } = createEnv({ storeDir: options.storeDir, storeType: options.storeType, fileFormat: options.fileFormat });
  const result = await extractSchemas({
    oldSchema,
    newSchema,
    mode: options.mode,
    schemaType: options.schemaType,
    outDir: options.outDir,
    subdirFormat: options.subdirFormat,
    dryRun: options.dryRun,
    store,
    parse,
  });

  if (result.dryRun) {
    if (options.json) {
      process.stdout.write(JSON.stringify({ mode: result.mode, keys: result.keys, dir: result.dir, tree: result.tree }, null, 2) + '\n');
      return;
    }
    console.log(JSON.stringify(result.tree, null, 2));
    console.log(`\n${result.keys.length} ${result.mode} -> ${result.dir} (dry run, nothing written; pass --no-dry-run to write)`);
    return;
  }

  if (options.json) {
    process.stdout.write(JSON.stringify(result.view, null, 2) + '\n');
    return;
  }
  printExtractView(result.view);
}

module.exports = { cmdExtract };
