const fs = require('fs');
const path = require('path');

/**
 * Reads and JSON.parses a file, with clean errors for the common failure
 * modes (missing file, wrong extension, invalid JSON) so callers never see
 * a raw Node stack trace.
 * GOTCHA: only validates the .json extension and that content parses as
 * JSON — does not validate encoding. A .json file with a BOM or non-UTF8
 * bytes can still throw a raw, less-friendly error from fs.readFileSync.
 * @param {string} filePath - path to a .json file
 * @returns {object} parsed JSON content
 * @throws {Error} "File not found", "Unsupported file type", or "Invalid JSON in ..."
 */
function parseFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.json') {
    throw new Error(`Unsupported file type "${ext}" — stage 1 supports .json only`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in ${filePath}: ${err.message}`);
  }
}

module.exports = { parseFile };
