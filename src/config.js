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
 * @property {string} defaultStoreDir - where the git-backed version store
 *   lives, overridable via SCHEMA_SNAPSHOT_STORE_DIR (see .env.example).
 *   Separate git repo from the project's own — see core/store/git.js.
 * @property {'git'} defaultStoreType - which Store implementation
 *   core/env.js's createEnv() constructs, overridable via
 *   SCHEMA_SNAPSHOT_STORE_TYPE (see .env.example). Must match a case in
 *   core/env.js's createStore(). Only "git" exists today; this exists so
 *   a future implementation is a config value away, not a code change.
 * @property {'json'} defaultFileFormat - which Parser core/env.js's
 *   createEnv() constructs, overridable via SCHEMA_SNAPSHOT_FILE_FORMAT
 *   (see .env.example). Must match a key registered in
 *   core/parsers/index.js. Only "json" exists today, same rationale as
 *   defaultStoreType.
 * @property {string} defaultSnapshotsDir - host-repo-tracked event log +
 *   content-addressed source dir (see docs/proposal-schema-snapshot-sync.md
 *   §2), overridable via SCHEMA_SNAPSHOT_SNAPSHOTS_DIR. Distinct from
 *   defaultStoreDir: this one IS meant to be committed by the host repo's
 *   own git, defaultStoreDir is not.
 */

/** @type {Config} */
const config = {
  defaultOutDir: process.env.SCHEMA_SNAPSHOT_OUT_DIR || '.snapshot/normalized',
  defaultSchemaType: process.env.SCHEMA_SNAPSHOT_TYPE || 'directus',
  defaultSubdirFormat: process.env.SCHEMA_SNAPSHOT_SUBDIR_FORMAT || '{time}_{name}',
  defaultStoreDir: process.env.SCHEMA_SNAPSHOT_STORE_DIR || '.snapshot/repo',
  defaultStoreType: process.env.SCHEMA_SNAPSHOT_STORE_TYPE || 'git',
  defaultFileFormat: process.env.SCHEMA_SNAPSHOT_FILE_FORMAT || 'json',
  defaultSnapshotsDir: process.env.SCHEMA_SNAPSHOT_SNAPSHOTS_DIR || 'schema-snapshots',
};

module.exports = config;
