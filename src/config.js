// Loads env vars into process.env. The only file in the codebase that
// reads process.env directly — everything else takes config as input.
//
// GOTCHA: dotenv resolves a bare filename against process.cwd(), not this
// file's location or the invoked script's directory. If this package is
// invoked via a wrapper that changes cwd (e.g. `npm run` sets cwd to the
// nearest package.json dir), the "obvious" env file sitting next to this
// package can be silently skipped in favor of one higher up the tree — no
// error, just wrong values loaded. resolveEnvFile() lets that be pinned
// explicitly instead of relying on cwd.
//
// This runs before commander parses argv (config.js is required at module
// load, and cli/index.js bakes config.defaultX into option defaults at that
// same time) — so --env-file can't go through commander normally and is
// pre-scanned from process.argv here instead.
const path = require('path');
const fs = require('fs');
const {
  ENV_VAR_ENV_FILE,
  ENV_VAR_OUT_DIR,
  ENV_VAR_TYPE,
  ENV_VAR_SUBDIR_FORMAT,
  ENV_VAR_STORE_DIR,
  ENV_VAR_STORE_TYPE,
  ENV_VAR_FILE_FORMAT,
  ENV_VAR_SNAPSHOTS_DIR,
} = require('./core/envVars');
const {
  DEFAULT_OUT_DIR,
  DEFAULT_SCHEMA_TYPE,
  DEFAULT_SUBDIR_FORMAT,
  DEFAULT_STORE_DIR,
  DEFAULT_STORE_TYPE,
  DEFAULT_FILE_FORMAT,
  DEFAULT_SNAPSHOTS_DIR,
} = require('./core/defaults');

// Own-namespaced default — kept in sync with core/operations/init.js's
// ENV_FILENAME (not imported from there: config.js must stay a
// standalone, side-effect-only module loaded before commander parses
// argv). `init` writes this file so a plain `.env` a host project
// already has is never touched or shadowed.
const DEFAULT_ENV_FILENAME = '.env.schema-snapshot';

/**
 * Resolves which env file to load, checked in order:
 * 1. `--env-file <path>` / `--env-file=<path>` CLI arg
 * 2. SCHEMA_SNAPSHOT_ENV_FILE environment variable
 * 3. `./.env.schema-snapshot` (cwd) if it exists
 * 4. `undefined` — dotenv falls back to its own default (cwd/.env)
 * @returns {string | undefined}
 */
function resolveEnvFile() {
  const idx = process.argv.findIndex((arg) => arg === '--env-file' || arg.startsWith('--env-file='));
  if (idx !== -1) {
    const arg = process.argv[idx];
    if (arg.includes('=')) return arg.slice(arg.indexOf('=') + 1);
    return process.argv[idx + 1];
  }
  if (process.env[ENV_VAR_ENV_FILE]) return process.env[ENV_VAR_ENV_FILE];

  const namespaced = path.join(process.cwd(), DEFAULT_ENV_FILENAME);
  if (fs.existsSync(namespaced)) return namespaced;

  return undefined;
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
 *   overridable via SCHEMA_SNAPSHOT_OUT_DIR (see .env.schema-snapshot.example)
 * @property {string} defaultSchemaType - default --schema-type for
 *   `normalize`/`diff`, overridable via SCHEMA_SNAPSHOT_TYPE (see
 *   .env.schema-snapshot.example). Must match a key registered in core/normalizers/index.js.
 * @property {string} defaultSubdirFormat - default --subdir-format for
 *   `normalize`, overridable via SCHEMA_SNAPSHOT_SUBDIR_FORMAT (see
 *   .env.schema-snapshot.example). Default "{time}_{name}" sorts chronologically across
 *   all inputs — see utils/fsTree.js's runSubDir() for placeholder docs.
 * @property {string} defaultStoreDir - where the git-backed version store
 *   lives, overridable via SCHEMA_SNAPSHOT_STORE_DIR (see .env.schema-snapshot.example).
 *   Separate git repo from the project's own — see core/store/git.js.
 * @property {'git'} defaultStoreType - which Store implementation
 *   core/env.js's createEnv() constructs, overridable via
 *   SCHEMA_SNAPSHOT_STORE_TYPE (see .env.schema-snapshot.example). Must match a case in
 *   core/env.js's createStore(). Only "git" exists today; this exists so
 *   a future implementation is a config value away, not a code change.
 * @property {'json'} defaultFileFormat - which Parser core/env.js's
 *   createEnv() constructs, overridable via SCHEMA_SNAPSHOT_FILE_FORMAT
 *   (see .env.schema-snapshot.example). Must match a key registered in
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
  defaultOutDir: envOr(ENV_VAR_OUT_DIR, DEFAULT_OUT_DIR),
  defaultSchemaType: envOr(ENV_VAR_TYPE, DEFAULT_SCHEMA_TYPE),
  defaultSubdirFormat: envOr(ENV_VAR_SUBDIR_FORMAT, DEFAULT_SUBDIR_FORMAT),
  defaultStoreDir: envOr(ENV_VAR_STORE_DIR, DEFAULT_STORE_DIR),
  defaultStoreType: envOr(ENV_VAR_STORE_TYPE, DEFAULT_STORE_TYPE),
  defaultFileFormat: envOr(ENV_VAR_FILE_FORMAT, DEFAULT_FILE_FORMAT),
  defaultSnapshotsDir: envOr(ENV_VAR_SNAPSHOTS_DIR, DEFAULT_SNAPSHOTS_DIR),
};

module.exports = config;
