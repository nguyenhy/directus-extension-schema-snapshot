const { getParser } = require('../../core/parsers');
const { normalizeSchema, buildMeta } = require('../../core/operations/normalize');
const { printNormalizeView } = require('../render/normalize');

/**
 * commander action handler for `normalize <schema.json>`.
 * Thin CLI glue: delegates to core/operations/normalize.js (reusable by a
 * UI backend too). Default behavior is to always write to disk (fresh
 * timestamped subdir per run) — --dry-run is the only way to get
 * stdout-only output with no filesystem writes.
 * @param {string} inputPath - schema.json argument from the CLI
 * @param {{outDir: string, dryRun?: boolean, schemaType: string, subdirFormat: string, fileFormat: string}} options - commander-parsed options
 */
function cmdNormalize(inputPath, options) {
  const { parse } = getParser(options.fileFormat);
  const result = normalizeSchema({
    inputPath,
    schemaType: options.schemaType,
    outDir: options.outDir,
    subdirFormat: options.subdirFormat,
    dryRun: options.dryRun,
    parse,
  });

  if (result.dryRun) {
    console.log(JSON.stringify(result.tree, null, 2));
    return;
  }
  printNormalizeView(result.view);
}

module.exports = { cmdNormalize, buildMeta };
