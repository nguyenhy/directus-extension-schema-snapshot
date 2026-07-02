const fs = require('fs');
const path = require('path');
const { parseFile } = require('../../utils/parse');
const { getNormalizer } = require('../../core/normalizers');
const { runSubDir, writeTreeToDir } = require('../../utils/fsTree');
const pkg = require('../../../package.json');

/**
 * Builds the meta.json summary for one normalize run.
 * GOTCHA: parses tree keys assuming core/directus/normalize.js's entityKey() format
 * "kind:collection.name" — silently mis-groups entries if that format
 * ever changes (no error, just wrong/missing entries in the summary).
 * @param {import('../../core/normalizers').EntityTree} tree - normalize() output
 * @param {string} inputPath - path to the source file, recorded as-is
 * @returns {{input: string, timestamp: string, toolVersion: string, counts: {collections: number, fields: number, relations: number}, collections: Object.<string, {fields: string[], relations: string[]}>}}
 */
function buildMeta(tree, inputPath) {
  const counts = { collections: 0, fields: 0, relations: 0 };
  const collections = {};

  for (const key of Object.keys(tree)) {
    const [kind, rest] = key.split(':');
    if (kind === 'collection') {
      counts.collections++;
      collections[rest] = collections[rest] || { fields: [], relations: [] };
    } else if (kind === 'field') {
      counts.fields++;
      const [collection, field] = rest.split('.');
      collections[collection] = collections[collection] || { fields: [], relations: [] };
      collections[collection].fields.push(field);
    } else if (kind === 'relation') {
      counts.relations++;
      const [collection, field] = rest.split('.');
      collections[collection] = collections[collection] || { fields: [], relations: [] };
      collections[collection].relations.push(field);
    }
  }

  return {
    input: inputPath,
    timestamp: new Date().toISOString(),
    toolVersion: pkg.version,
    counts,
    collections,
  };
}

/**
 * commander action handler for `normalize <schema.json>`.
 * Default behavior is to always write to disk (fresh timestamped subdir
 * per run, see fsTree.js's runSubDir()) — --dry-run is the only way to get
 * stdout-only output with no filesystem writes.
 * @param {string} inputPath - schema.json argument from the CLI
 * @param {{outDir: string, dryRun?: boolean, schemaType: string, subdirFormat: string}} options - commander-parsed options
 */
function cmdNormalize(inputPath, options) {
  const { normalize } = getNormalizer(options.schemaType);
  const tree = normalize(parseFile(inputPath));
  if (options.dryRun) {
    console.log(JSON.stringify(tree, null, 2));
    return;
  }
  const dir = runSubDir(options.outDir, inputPath, options.subdirFormat);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(inputPath, path.join(dir, `original${path.extname(inputPath)}`));
  writeTreeToDir(tree, dir);
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(buildMeta(tree, inputPath), null, 2) + '\n');
  console.log(`Normalized ${Object.keys(tree).length} entities -> ${dir}`);
}

module.exports = { cmdNormalize, buildMeta };
