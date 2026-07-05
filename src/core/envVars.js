/**
 * Single source of truth for every SCHEMA_SNAPSHOT_* env var name — used
 * by src/config.js (envOr lookups), core/operations/init.js
 * (OVERRIDABLE_VARS / renderEnvContent), and cli/commands/init.js
 * (OPTION_TO_ENV_VAR) so each var name string is written exactly once.
 * Add a new var here first, then wire it into those three call sites.
 */
const ENV_VAR_ENV_FILE = 'SCHEMA_SNAPSHOT_ENV_FILE';
const ENV_VAR_OUT_DIR = 'SCHEMA_SNAPSHOT_OUT_DIR';
const ENV_VAR_TYPE = 'SCHEMA_SNAPSHOT_TYPE';
const ENV_VAR_SUBDIR_FORMAT = 'SCHEMA_SNAPSHOT_SUBDIR_FORMAT';
const ENV_VAR_STORE_DIR = 'SCHEMA_SNAPSHOT_STORE_DIR';
const ENV_VAR_STORE_TYPE = 'SCHEMA_SNAPSHOT_STORE_TYPE';
const ENV_VAR_FILE_FORMAT = 'SCHEMA_SNAPSHOT_FILE_FORMAT';
const ENV_VAR_SNAPSHOTS_DIR = 'SCHEMA_SNAPSHOT_SNAPSHOTS_DIR';

module.exports = {
  ENV_VAR_ENV_FILE,
  ENV_VAR_OUT_DIR,
  ENV_VAR_TYPE,
  ENV_VAR_SUBDIR_FORMAT,
  ENV_VAR_STORE_DIR,
  ENV_VAR_STORE_TYPE,
  ENV_VAR_FILE_FORMAT,
  ENV_VAR_SNAPSHOTS_DIR,
};
