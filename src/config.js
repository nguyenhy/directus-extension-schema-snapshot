// Loads .env (if present) into process.env. The only file in the codebase
// that reads process.env directly — everything else takes config as input.
//
// GOTCHA: dotenv resolves its default path against process.cwd(), not this
// file's location or the invoked script's directory. If this package is
// invoked via a wrapper that changes cwd (e.g. `npm run` sets cwd to the
// nearest package.json dir), the "obvious" .env sitting next to this
// package can be silently skipped in favor of one higher up the tree — no
// error, just wrong values loaded. resolveEnvFile() lets that be pinned
// explicitly instead of relying on cwd.
//
// This runs before commander parses argv (config.js is required at module
// load, and cli/index.js bakes config.defaultX into option defaults at that
// same time) — so --env-file can't go through commander normally and is
// pre-scanned from process.argv here instead.
/**
 * Resolves which .env file to load, checked in order:
 * 1. `--env-file <path>` / `--env-file=<path>` CLI arg
 * 2. SCHEMA_SNAPSHOT_ENV_FILE environment variable
 * 3. undefined — dotenv falls back to its own default (cwd/.env)
 * @returns {string | undefined}
 */
function resolveEnvFile() {
  const idx = process.argv.findIndex((arg) => arg === '--env-file' || arg.startsWith('--env-file='));
  if (idx !== -1) {
    const arg = process.argv[idx];
    if (arg.includes('=')) return arg.slice(arg.indexOf('=') + 1);
    return process.argv[idx + 1];
  }
  return process.env.SCHEMA_SNAPSHOT_ENV_FILE || undefined;
}

require('dotenv').config({ quiet: true, path: resolveEnvFile() });

/**
 * Reads an env var, falling back only when truly unset — unlike `||`, an
 * explicitly empty string (`SCHEMA_SNAPSHOT_X=`) is respected as-is instead
 * of silently reverting to the hardcode default.
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
function envOr(name, fallback) {
  return process.env[name] !== undefined ? process.env[name] : fallback;
}

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
  defaultOutDir: envOr('SCHEMA_SNAPSHOT_OUT_DIR', '.snapshot/normalized'),
  defaultSchemaType: envOr('SCHEMA_SNAPSHOT_TYPE', 'directus'),
  defaultSubdirFormat: envOr('SCHEMA_SNAPSHOT_SUBDIR_FORMAT', '{time}_{name}'),
  defaultStoreDir: envOr('SCHEMA_SNAPSHOT_STORE_DIR', '.snapshot/repo'),
  defaultStoreType: envOr('SCHEMA_SNAPSHOT_STORE_TYPE', 'git'),
  defaultFileFormat: envOr('SCHEMA_SNAPSHOT_FILE_FORMAT', 'json'),
  defaultSnapshotsDir: envOr('SCHEMA_SNAPSHOT_SNAPSHOTS_DIR', 'schema-snapshots'),
};

module.exports = config;
