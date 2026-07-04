const fs = require('fs');
const path = require('path');
const { timestamp } = require('./timestamp');

/** Placeholders recognized in a subdir format template, see runSubDir(). */
const SUBDIR_PLACEHOLDERS = { name: 'basename of the input file (no extension)', time: 'YYYYMMDD-HHmmss' };

/**
 * Builds a unique subdir path for one normalize run from a format template,
 * so repeated runs never collide/overwrite each other. Full documentation
 * (placeholders, examples, validation rules): docs/architecture.md#subdir-format.
 * @param {string} outDir - parent directory (default or --out-dir)
 * @param {string} inputPath - path to the input file being normalized
 * @param {string} format - template string using {name} and {time}
 *   placeholders, e.g. "{time}_{name}" (default) or "{name}/{time}" for a
 *   nested-by-input layout.
 * @returns {string} "<outDir>/<rendered template>"
 * @throws {Error} if the template contains no placeholders, references an
 *   unknown placeholder, or renders to an unsafe path (any segment empty,
 *   "." or ".." — ".." specifically would let the rendered path escape
 *   outDir, which defeats the "always a fresh subdir" guarantee)
 */
function runSubDir(outDir, inputPath, format) {
  const values = {
    name: path.basename(inputPath, path.extname(inputPath)),
    time: timestamp(),
  };

  const usedPlaceholders = [...format.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  if (usedPlaceholders.length === 0) {
    throw new Error(`Invalid subdir format "${format}": must use at least one of {${Object.keys(SUBDIR_PLACEHOLDERS).join('}, {')}}`);
  }
  for (const key of usedPlaceholders) {
    if (!(key in values)) {
      throw new Error(`Invalid subdir format "${format}": unknown placeholder {${key}}. Available: {${Object.keys(SUBDIR_PLACEHOLDERS).join('}, {')}}`);
    }
  }

  const rendered = format.replace(/\{(\w+)\}/g, (_, key) => values[key]);
  const segments = rendered.split('/');
  if (segments.some((seg) => seg === '' || seg === '.' || seg === '..')) {
    throw new Error(`Invalid subdir format "${format}": rendered to "${rendered}", which is not a safe path (empty, ".", or ".." segment)`);
  }

  return path.join(outDir, rendered);
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

/**
 * Inverse of writeTreeToDir(): reads a previously-written entity tree back
 * from disk into the flat EntityTree shape. Used to recover "what was here
 * before" without needing a separate stored copy (e.g. GitStore reads the
 * working dir's current content, right before overwriting it, to diff
 * against the incoming version).
 * @param {string} dir - directory previously written by writeTreeToDir()
 * @returns {import('../core/normalizers').EntityTree} empty object if dir doesn't exist yet
 */
function readTreeFromDir(dir) {
  const tree = {};
  if (!fs.existsSync(dir)) return tree;
  for (const kind of fs.readdirSync(dir)) {
    const kindDir = path.join(dir, kind);
    if (!fs.statSync(kindDir).isDirectory()) continue;
    for (const file of fs.readdirSync(kindDir)) {
      if (!file.endsWith('.json')) continue;
      const name = file.slice(0, -'.json'.length);
      tree[`${kind}:${name}`] = JSON.parse(fs.readFileSync(path.join(kindDir, file), 'utf8'));
    }
  }
  return tree;
}

/**
 * Like writeTreeToDir(), but only touches files whose entity actually
 * changed relative to `previousTree` — writes added/modified entities,
 * deletes removed ones, leaves unchanged ones untouched. Used by
 * GitStore.set() so a commit's file I/O is proportional to the diff size,
 * not to the full tree size (see writeTreeToDir()'s GOTCHA re: key format,
 * which applies here too).
 * @param {import('../core/normalizers').EntityTree} tree - new tree to write
 * @param {import('../core/normalizers').EntityTree} previousTree - tree
 *   currently on disk (as read by readTreeFromDir()), used to skip
 *   unchanged entities and find removed ones
 * @param {string} dir - target directory
 */
function writeTreeDelta(tree, previousTree, dir) {
  const oldKeys = Object.keys(previousTree);
  const newKeys = new Set(Object.keys(tree));

  for (const key of oldKeys) {
    if (newKeys.has(key)) continue;
    const [kind, name] = key.split(':');
    const file = path.join(dir, kind, `${name}.json`);
    if (fs.existsSync(file)) fs.rmSync(file);
  }

  for (const key of newKeys) {
    if (JSON.stringify(previousTree[key]) === JSON.stringify(tree[key])) continue;
    const [kind, name] = key.split(':');
    const kindDir = path.join(dir, kind);
    fs.mkdirSync(kindDir, { recursive: true });
    const file = path.join(kindDir, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(tree[key], null, 2) + '\n');
  }
}

module.exports = { runSubDir, writeTreeToDir, writeTreeDelta, readTreeFromDir, SUBDIR_PLACEHOLDERS };
