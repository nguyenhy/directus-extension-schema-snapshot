const path = require('path');
const fs = require('../core/platform/fs');
const { timestamp } = require('./timestamp');
const { InvalidSubdirFormatError } = require('../core/errors');
const { isValidFilename } = require('../core/hash');

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
    throw new InvalidSubdirFormatError(`Invalid subdir format "${format}": must use at least one of {${Object.keys(SUBDIR_PLACEHOLDERS).join('}, {')}}`);
  }
  for (const key of usedPlaceholders) {
    if (!(key in values)) {
      throw new InvalidSubdirFormatError(`Invalid subdir format "${format}": unknown placeholder {${key}}. Available: {${Object.keys(SUBDIR_PLACEHOLDERS).join('}, {')}}`);
    }
  }

  const rendered = format.replace(/\{(\w+)\}/g, (_, key) => values[key]);
  const segments = rendered.split('/');
  if (segments.some((seg) => seg === '' || seg === '.' || seg === '..')) {
    throw new InvalidSubdirFormatError(`Invalid subdir format "${format}": rendered to "${rendered}", which is not a safe path (empty, ".", or ".." segment)`);
  }

  return path.join(outDir, rendered);
}

/**
 * Picks the on-disk filename (no extension) for one entity: its own
 * "collection" / "collection.field" identity when that's a safe path
 * segment (isValidFilename), falling back to the hash half of its key
 * otherwise. `kind === 'meta'` entries are never hash-keyed (their key's
 * second half is already the human name, e.g. "meta:version") so they pass
 * through untouched.
 * @param {string} kind
 * @param {string} hashOrName - second half of the entity key
 * @param {*} value - the entity's own (stripVolatile'd) content
 * @returns {string}
 */
function fileNameFor(kind, hashOrName, value) {
  if (kind === 'meta') return hashOrName;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const identity = 'field' in value ? `${value.collection}.${value.field}` : ('collection' in value ? value.collection : null);
    if (identity && isValidFilename(identity)) return identity;
  }
  return hashOrName;
}

/**
 * Builds the "map.json" sidecar: entity key -> its identifying fields
 * (collection/field) plus the actual filename chosen for it (see
 * fileNameFor()) — since a key's hash half no longer always equals the
 * filename, map.json is also what readTreeFromDir() uses to invert
 * filename -> key for hash-keyed kinds.
 * @param {import('../core/normalizers').EntityTree} tree
 * @returns {Object.<string, {collection?: string, field?: string, file: string}>}
 */
function buildKeyMap(tree) {
  /** @type {Object.<string, {collection?: string, field?: string, file: string}>} */
  const map = {};
  for (const key of Object.keys(tree)) {
    const [kind, hashOrName] = key.split(':');
    if (kind === 'meta') continue;
    const value = tree[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && ('collection' in value || 'field' in value)) {
      const entry = { file: fileNameFor(kind, hashOrName, value) };
      if ('collection' in value) entry.collection = value.collection;
      if ('field' in value) entry.field = value.field;
      map[key] = entry;
    }
  }
  return map;
}

/**
 * Writes a normalize()-output tree to disk as one file per entity, plus a
 * map.json sidecar (see buildKeyMap()). Filenames prefer the entity's own
 * "collection"/"collection.field" identity (fileNameFor()) — falling back
 * to the hash half of the key only when that identity isn't a safe path
 * segment (attacker-controlled collection/field content).
 * @param {import('../core/normalizers').EntityTree} tree - normalize() output
 * @param {string} dir - target directory (created if missing)
 */
function writeTreeToDir(tree, dir) {
  for (const key of Object.keys(tree)) {
    const [kind, hashOrName] = key.split(':');
    const kindDir = path.join(dir, kind);
    fs.mkdir(kindDir);
    const value = tree[key];
    const fileName = fileNameFor(kind, hashOrName, value);
    const file = path.join(kindDir, `${fileName}.json`);
    fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');
  }
  const map = buildKeyMap(tree);
  if (Object.keys(map).length > 0) {
    fs.writeFile(path.join(dir, 'map.json'), JSON.stringify(map, null, 2) + '\n');
  }
}

/**
 * Inverse of writeTreeToDir(): reads a previously-written entity tree back
 * from disk into the flat EntityTree shape. Used to recover "what was here
 * before" without needing a separate stored copy (e.g. GitStore reads the
 * working dir's current content, right before overwriting it, to diff
 * against the incoming version).
 * GOTCHA: hash-keyed kinds (everything but "meta") no longer have a
 * filename == key.split(':')[1] guarantee (see fileNameFor()), so those are
 * read via map.json's `file` field, not directory listing. "meta" kind has
 * no map.json entries (its filename always equals the key's name half) so
 * it's still read via plain directory listing.
 * @param {string} dir - directory previously written by writeTreeToDir()
 * @returns {import('../core/normalizers').EntityTree} empty object if dir doesn't exist yet
 */
function readTreeFromDir(dir) {
  const tree = {};
  if (!fs.exists(dir)) return tree;

  const mapPath = path.join(dir, 'map.json');
  const map = fs.exists(mapPath) ? JSON.parse(fs.readFile(mapPath)) : {};
  for (const key of Object.keys(map)) {
    const kind = key.split(':')[0];
    const file = path.join(dir, kind, `${map[key].file}.json`);
    if (fs.exists(file)) tree[key] = JSON.parse(fs.readFile(file));
  }

  const metaDir = path.join(dir, 'meta');
  if (fs.exists(metaDir) && fs.isDirectory(metaDir)) {
    for (const file of fs.readdir(metaDir)) {
      if (!file.endsWith('.json')) continue;
      const name = file.slice(0, -'.json'.length);
      tree[`meta:${name}`] = JSON.parse(fs.readFile(path.join(metaDir, file)));
    }
  }

  return tree;
}

/**
 * Like writeTreeToDir(), but only touches files whose entity actually
 * changed relative to `previousTree` — writes added/modified entities,
 * deletes removed ones, leaves unchanged ones untouched. Used by
 * GitStore.set() so a commit's file I/O is proportional to the diff size,
 * not to the full tree size (see writeTreeToDir()'s GOTCHA re: filenames,
 * which applies here too — old entities' filenames are recomputed from
 * `previousTree`'s still-in-memory value, not re-derived from disk).
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
    const [kind, hashOrName] = key.split(':');
    const fileName = fileNameFor(kind, hashOrName, previousTree[key]);
    const file = path.join(dir, kind, `${fileName}.json`);
    if (fs.exists(file)) fs.remove(file, { force: true });
  }

  for (const key of newKeys) {
    if (JSON.stringify(previousTree[key]) === JSON.stringify(tree[key])) continue;
    const [kind, hashOrName] = key.split(':');
    const kindDir = path.join(dir, kind);
    fs.mkdir(kindDir);
    const value = tree[key];
    const fileName = fileNameFor(kind, hashOrName, value);
    const file = path.join(kindDir, `${fileName}.json`);
    fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');
  }

  const mapPath = path.join(dir, 'map.json');
  const existingMap = fs.exists(mapPath) ? JSON.parse(fs.readFile(mapPath)) : {};
  const newMap = buildKeyMap(tree);
  for (const key of oldKeys) {
    if (!newKeys.has(key)) delete existingMap[key];
  }
  Object.assign(existingMap, newMap);

  if (Object.keys(existingMap).length > 0) {
    fs.writeFile(mapPath, JSON.stringify(existingMap, null, 2) + '\n');
  } else if (fs.exists(mapPath)) {
    fs.remove(mapPath, { force: true });
  }
}

module.exports = { runSubDir, writeTreeToDir, writeTreeDelta, readTreeFromDir, buildKeyMap, SUBDIR_PLACEHOLDERS, fileNameFor };
