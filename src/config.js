// Loads .env (if present) into process.env. The only file in the codebase
// that reads process.env directly — everything else takes config as input.
require('dotenv').config({ quiet: true });

/**
 * @typedef {object} Config
 * @property {string} defaultOutDir - default --out-dir for `normalize`,
 *   overridable via SCHEMA_SNAPSHOT_OUT_DIR (see .env.example)
 * @property {string} defaultSchemaType - default --schema-type for
 *   `normalize`/`diff`, overridable via SCHEMA_SNAPSHOT_TYPE (see
 *   .env.example). Must match a key registered in core/normalizers/index.js.
 */

/** @type {Config} */
const config = {
  defaultOutDir: process.env.SCHEMA_SNAPSHOT_OUT_DIR || '.snapshot/normalized',
  defaultSchemaType: process.env.SCHEMA_SNAPSHOT_TYPE || 'directus',
};

module.exports = config;
