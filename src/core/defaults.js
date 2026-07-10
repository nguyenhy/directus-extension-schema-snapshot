/**
 * Default values for every SCHEMA_SNAPSHOT_* config var — the single
 * source of truth both `config.js` (envOr() fallbacks) and any core/
 * module that needs a default without loading env (e.g.
 * core/operations/init.js, which can't require config.js itself: that
 * module has load-time side effects — dotenv, argv pre-scanning) import
 * from. Add a new default here first, then wire it into config.js's
 * `config` object.
 */
const DEFAULT_OUT_DIR = '.snapshot/normalized';
const DEFAULT_SCHEMA_TYPE = 'directus';
const DEFAULT_SUBDIR_FORMAT = '{time}_{name}';
const DEFAULT_STORE_DIR = '.snapshot/repo';
const DEFAULT_STORE_TYPE = 'git';
const DEFAULT_FILE_FORMAT = 'json';
const DEFAULT_SNAPSHOTS_DIR = 'schema-snapshots';

module.exports = {
  DEFAULT_OUT_DIR,
  DEFAULT_SCHEMA_TYPE,
  DEFAULT_SUBDIR_FORMAT,
  DEFAULT_STORE_DIR,
  DEFAULT_STORE_TYPE,
  DEFAULT_FILE_FORMAT,
  DEFAULT_SNAPSHOTS_DIR,
};
