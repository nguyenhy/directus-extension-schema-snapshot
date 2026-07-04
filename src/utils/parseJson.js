const fs = require('fs');
const { FileNotFoundError, InvalidJSONError } = require('../core/errors');

/**
 * Reads and JSON.parses a file, with clean errors for the common failure
 * modes (missing file, invalid JSON) so callers never see a raw Node
 * stack trace. GOTCHA: does not validate encoding — a file with a BOM or
 * non-UTF8 bytes can still throw a raw, less-friendly error from
 * fs.readFileSync. Extension/format selection is not this function's
 * job — see core/parsers/index.js, which decides *which* parser (this
 * one, or a future yaml one) to call.
 * @param {string} filePath - path to a JSON file
 * @returns {object} parsed JSON content
 * @throws {Error} "File not found" or "Invalid JSON in ..."
 */
function parseJSONFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new FileNotFoundError(`File not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new InvalidJSONError(`Invalid JSON in ${filePath}: ${err.message}`);
  }
}

module.exports = { parseJSONFile };
