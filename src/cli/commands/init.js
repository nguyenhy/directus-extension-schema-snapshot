const path = require('path');
const { createEnv } = require('../../core/env');
const { initRepo, assertReadyForInit } = require('../../core/operations/init');
const { printInitView } = require('../render/init');

// Maps commander option names to the SCHEMA_SNAPSHOT_* var each one
// overrides in the scaffolded env file — see core/operations/init.js's
// OVERRIDABLE_VARS for the authoritative var list.
const OPTION_TO_ENV_VAR = {
  outDir: 'SCHEMA_SNAPSHOT_OUT_DIR',
  schemaType: 'SCHEMA_SNAPSHOT_TYPE',
  subdirFormat: 'SCHEMA_SNAPSHOT_SUBDIR_FORMAT',
  storeDir: 'SCHEMA_SNAPSHOT_STORE_DIR',
  storeType: 'SCHEMA_SNAPSHOT_STORE_TYPE',
  fileFormat: 'SCHEMA_SNAPSHOT_FILE_FORMAT',
  snapshotsDir: 'SCHEMA_SNAPSHOT_SNAPSHOTS_DIR',
};

/**
 * commander action handler for `init [dir]`.
 * `storeDir`/`snapshotsDir` are resolved relative to the target `dir`
 * (not cwd) — init is setting up `dir`, so its store should live inside
 * `dir`, matching what `.env.schema-snapshot` (copied into `dir`) will
 * point at once the user cds there.
 *
 * Every option in OPTION_TO_ENV_VAR is written into the scaffolded env
 * file (see initRepo's `envOverrides`) — whether from an explicit flag
 * or its commander default, so the written file always reflects what
 * this run actually used, not just the template's own defaults.
 *
 * `assertReadyForInit` runs BEFORE `createEnv` constructs the Store —
 * GitStore's constructor eagerly `mkdir`s its storeDir, which would make
 * `dir` look non-empty to the check if done after. See that function's
 * doc in core/operations/init.js.
 * @param {string} dir - target directory argument from the CLI
 * @param {{storeDir: string, storeType: string, outDir: string, schemaType: string, subdirFormat: string, fileFormat: string, snapshotsDir: string, json?: boolean}} options - commander-parsed options
 */
async function cmdInit(dir, options) {
  assertReadyForInit(dir);
  const { store } = createEnv({ storeDir: path.join(dir, options.storeDir), storeType: options.storeType });

  const envOverrides = {};
  for (const [optionName, envVar] of Object.entries(OPTION_TO_ENV_VAR)) {
    if (options[optionName] !== undefined) envOverrides[envVar] = options[optionName];
  }

  const view = await initRepo({ dir, store, envOverrides });

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    return;
  }
  printInitView(view);
}

module.exports = { cmdInit };
