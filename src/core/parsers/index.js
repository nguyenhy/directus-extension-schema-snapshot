const { parseJSONFile } = require('../../utils/parseJson');

/**
 * @typedef {object} Parser
 * @property {(filePath: string) => object} parse - reads + parses a schema
 *   file, throwing clean errors on missing file / bad content.
 */

/** @type {Object.<string, Parser>} */
const parsers = {
  json: { parse: parseJSONFile },
};

/**
 * Looks up a registered parser by file format. Throws instead of
 * returning undefined so an unknown format fails loudly at the
 * composition root rather than producing a silent wrong-shaped object
 * downstream. Mirrors core/normalizers/index.js's getNormalizer() —
 * adding a new format (e.g. yaml) means writing utils/parseYaml.js and
 * registering one more entry here, no other file changes.
 * @param {string} format - file format key, e.g. "json"
 * @returns {Parser}
 * @throws {Error} if no parser is registered under that key
 */
function getParser(format) {
  const parser = parsers[format];
  if (!parser) {
    throw new Error(`Unknown file format "${format}". Available: ${Object.keys(parsers).join(', ')}`);
  }
  return parser;
}

module.exports = { getParser, parsers };
