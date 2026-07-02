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
 * @property {string} defaultSubdirFormat - default --subdir-format for
 *   `normalize`, overridable via SCHEMA_SNAPSHOT_SUBDIR_FORMAT (see
 *   .env.example). Default "{time}_{name}" sorts chronologically across
 *   all inputs — see utils/fsTree.js's runSubDir() for placeholder docs.
 */

/** @type {Config} */
const config = {
  defaultOutDir: process.env.SCHEMA_SNAPSHOT_OUT_DIR || '.snapshot/normalized',
  defaultSchemaType: process.env.SCHEMA_SNAPSHOT_TYPE || 'directus',
  defaultSubdirFormat: process.env.SCHEMA_SNAPSHOT_SUBDIR_FORMAT || '{time}_{name}',
};

module.exports = config;
