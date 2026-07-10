const path = require('path');
const readline = require('readline');
const { createEnv } = require('../../core/env');
const { initRepo, checkInitConflict } = require('../../core/operations/init');
const { printInitView } = require('../render/init');
const {
  ENV_VAR_OUT_DIR,
  ENV_VAR_TYPE,
  ENV_VAR_SUBDIR_FORMAT,
  ENV_VAR_STORE_DIR,
  ENV_VAR_STORE_TYPE,
  ENV_VAR_FILE_FORMAT,
  ENV_VAR_SNAPSHOTS_DIR,
} = require('../../core/envVars');

// Maps commander option names to the SCHEMA_SNAPSHOT_* var each one
// overrides in the scaffolded env file — see core/operations/init.js's
// OVERRIDABLE_VARS for the authoritative var list.
const OPTION_TO_ENV_VAR = {
  outDir: ENV_VAR_OUT_DIR,
  schemaType: ENV_VAR_TYPE,
  subdirFormat: ENV_VAR_SUBDIR_FORMAT,
  storeDir: ENV_VAR_STORE_DIR,
  storeType: ENV_VAR_STORE_TYPE,
  fileFormat: ENV_VAR_FILE_FORMAT,
  snapshotsDir: ENV_VAR_SNAPSHOTS_DIR,
};

/**
 * Prompts "override? [y/N]" on the given TTY streams. Only ever called
 * when stdin is a TTY (see cmdInit) — a piped/CI stdin has no one to
 * answer, so that path skips straight to the doc-and-exit fallback
 * instead of hanging on a prompt that will never resolve.
 * @param {string} message
 * @returns {Promise<boolean>}
 */
function promptOverride(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} Override? [y/N] `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

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
 * `checkInitConflict` runs BEFORE `createEnv` constructs the Store —
 * GitStore's constructor eagerly `mkdir`s its storeDir, which would make
 * `dir` look non-empty to the check if done after. See that function's
 * doc in core/operations/init.js.
 *
 * On conflict: `--yes` overrides without asking; otherwise, if stdin is a
 * TTY, prompts "override? [y/N]"; otherwise (non-interactive, e.g. CI)
 * prints the conflict + a pointer to manual setup steps and returns
 * without throwing — no hung prompt, no stack trace.
 * @param {string} dir - target directory argument from the CLI
 * @param {{storeDir: string, storeType: string, outDir: string, schemaType: string, subdirFormat: string, fileFormat: string, snapshotsDir: string, json?: boolean}} options - commander-parsed options
 */
async function cmdInit(dir, options) {
  const conflict = checkInitConflict(dir);
  if (conflict) {
    const canPrompt = !options.yes && process.stdin.isTTY;
    const proceed = options.yes || (canPrompt && (await promptOverride(conflict.message)));
    if (!proceed) {
      console.log(`Error: ${conflict.message}`);
      console.log('See README.md "Getting started" for manual setup steps (copy .env.schema-snapshot.example, add .snapshot/ to .gitignore, run `add`).');
      return;
    }
  }
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
