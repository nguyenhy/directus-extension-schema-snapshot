const fs = require('fs');
const path = require('path');
const { timestamp } = require('./timestamp');

/**
 * Builds a unique, human-readable subdir path for one normalize run, so
 * repeated runs never collide/overwrite each other.
 * @param {string} outDir - parent directory (default or --out-dir)
 * @param {string} inputPath - path to the input file being normalized
 * @returns {string} "<outDir>/<basename-of-input>_<YYYYMMDD-HHmmss>"
 */
function runSubDir(outDir, inputPath) {
  const base = path.basename(inputPath, path.extname(inputPath));
  return path.join(outDir, `${base}_${timestamp()}`);
}

/**
 * Writes a normalize()-output tree to disk as one file per entity.
 * GOTCHA: relies on entityKey()'s "kind:name" format (see core/directus/normalize.js)
 * — splits each key on ":" to derive the subdirectory ("kind") and filename
 * ("name"). If entityKey()'s format changes, this silently writes to wrong
 * paths rather than erroring.
 * @param {import('../core/normalizers').EntityTree} tree - normalize() output
 * @param {string} dir - target directory (created if missing)
 */
function writeTreeToDir(tree, dir) {
  for (const key of Object.keys(tree)) {
    const [kind, name] = key.split(':');
    const kindDir = path.join(dir, kind);
    fs.mkdirSync(kindDir, { recursive: true });
    const file = path.join(kindDir, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(tree[key], null, 2) + '\n');
  }
}

module.exports = { runSubDir, writeTreeToDir };
