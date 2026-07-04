const fs = require('fs');
const path = require('path');
const { getNormalizer } = require('../normalizers');
const { runSubDir, writeTreeToDir } = require('../../utils/fsTree');
const { buildNormalizeView } = require('../present/normalize');
const { buildTreeSummary } = require('../treeSummary');
const pkg = require('../../../package.json');

/**
 * Builds the meta.json summary for one normalize run.
 * @param {import('../normalizers').EntityTree} tree - normalize() output
 * @param {string} inputPath - path to the source file, recorded as-is
 * @returns {{input: string, timestamp: string, toolVersion: string, counts: {collections: number, fields: number, relations: number}, collections: Object.<string, {fields: string[], relations: string[]}>}}
 */
function buildMeta(tree, inputPath) {
  return {
    input: inputPath,
    timestamp: new Date().toISOString(),
    toolVersion: pkg.version,
    ...buildTreeSummary(tree),
  };
}

/**
 * Normalizes a schema file. In dry-run mode, just returns the tree
 * (already-pure core data — no view needed). Otherwise writes a fresh
 * timestamped run dir (original file + per-entity json + meta.json) and
 * returns the confirmation view. Reusable by cmdNormalize or a UI backend.
 * @param {{inputPath: string, schemaType: string, outDir: string, subdirFormat: string, dryRun?: boolean, parse: (filePath: string) => object}} params
 *   `parse` is a required, injected dependency — see core/operations/add.js
 *   for the rationale.
 * @returns {{dryRun: true, tree: import('../normalizers').EntityTree} | {dryRun: false, view: ReturnType<typeof buildNormalizeView>}}
 */
function normalizeSchema({ inputPath, schemaType, outDir, subdirFormat, dryRun, parse }) {
  const { normalize } = getNormalizer(schemaType);
  const tree = normalize(parse(inputPath));

  if (dryRun) {
    return { dryRun: true, tree };
  }

  const dir = runSubDir(outDir, inputPath, subdirFormat);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(inputPath, path.join(dir, `original${path.extname(inputPath)}`));
  writeTreeToDir(tree, dir);
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(buildMeta(tree, inputPath), null, 2) + '\n');

  return { dryRun: false, view: buildNormalizeView(tree, dir) };
}

module.exports = { normalizeSchema, buildMeta };
