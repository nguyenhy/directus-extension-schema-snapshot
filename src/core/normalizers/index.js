const directus = require('../directus/normalize');
const { UnknownSchemaTypeError } = require('../errors');

/**
 * Flat map keyed by entityKey()'s "kind:name" format (see
 * core/directus/normalize.js) — key is not an arbitrary string, it must
 * match that format. Values are normalizer-specific entity records; shape
 * is NOT guaranteed uniform across kinds (collection vs. field vs.
 * relation) or across different registered normalizers. This is the one
 * shared typedef for that shape — reference it via
 * `{import('./index').EntityTree}` instead of re-typing
 * `Object.<string, object>` inline, so the "keys follow entityKey() format"
 * contract lives in one place.
 * @typedef {Object.<string, object>} EntityTree
 */

/**
 * @typedef {object} Normalizer
 * @property {(rawSchema: object) => EntityTree} normalize -
 *   raw parsed JSON -> EntityTree.
 */

/** @type {Object.<string, Normalizer>} */
const normalizers = {
  directus,
};

/**
 * Looks up a registered normalizer by schema type. Throws instead of
 * returning undefined so an unknown --schema-type fails loudly at the CLI
 * boundary rather than producing a silent empty tree downstream.
 * @param {string} type - schema type key, e.g. "directus"
 * @returns {Normalizer}
 * @throws {Error} if no normalizer is registered under that key
 */
function getNormalizer(type) {
  const normalizer = normalizers[type];
  if (!normalizer) {
    throw new UnknownSchemaTypeError(`Unknown schema type "${type}". Available: ${Object.keys(normalizers).join(', ')}`);
  }
  return normalizer;
}

module.exports = { getNormalizer, normalizers };
