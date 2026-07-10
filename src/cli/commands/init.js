const {
  initRepo,
  checkInitConflict,
  checkEnvFile,
} = require("../../core/operations/init");
const {
  printInitView,
  printInitConflict,
  promptProceedAnyway,
  promptOverwriteEnv,
} = require("../render/init");
const {
  ENV_VAR_OUT_DIR,
  ENV_VAR_TYPE,
  ENV_VAR_SUBDIR_FORMAT,
  ENV_VAR_STORE_DIR,
  ENV_VAR_STORE_TYPE,
  ENV_VAR_FILE_FORMAT,
  ENV_VAR_SNAPSHOTS_DIR,
} = require("../../core/envVars");

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
 * commander action handler for `init [dir]`.
 *
 * `init`'s scope is narrow: write `.env.schema-snapshot`, write
 * `.gitignore`, and validate `SCHEMA_SNAPSHOT_SNAPSHOTS_DIR`
 * (schema-snapshots/, host-repo-committed) is empty or already a valid
 * event log. It no longer touches or checks `SCHEMA_SNAPSHOT_OUT_DIR` /
 * `SCHEMA_SNAPSHOT_STORE_DIR` at all — both live under the gitignored
 * `.snapshot/` cache, which `add` creates lazily and idempotently on
 * first use; see core/operations/init.js's checkInitConflict doc.
 *
 * Two independent prompts can fire, both skipped by `--yes` and both
 * falling back to a safe default (never overwrite/never proceed) when
 * stdin isn't a TTY:
 * - `.env.schema-snapshot` already exists → ask to overwrite with the
 *   fresh template, or leave it (user copies values over manually).
 * - `schema-snapshots/` has foreign (non-event-log) content → ask to
 *   proceed anyway, since it's ambiguous whether that's a mistake. A
 *   schema-snapshots/ with only a valid prior event log never reaches
 *   this prompt at all — checkInitConflict treats that as a non-conflict
 *   (idempotent "init after init").
 * @param {string} dir - target directory argument from the CLI
 * @param {{storeDir: string, storeType: string, outDir: string, schemaType: string, subdirFormat: string, fileFormat: string, snapshotsDir: string, json?: boolean, yes?: boolean}} options - commander-parsed options
 */
async function cmdInit(dir, options) {
  const canPrompt = !options.yes && process.stdin.isTTY;

  const conflict = checkInitConflict(dir, options.snapshotsDir);
  if (conflict) {
    const proceed =
      options.yes || (canPrompt && (await promptProceedAnyway(conflict)));
    if (!proceed) {
      printInitConflict(conflict);
      return;
    }
  }

  const { exists: envAlreadyExisted, envPath } = checkEnvFile(dir);
  let overwriteEnv = false;
  if (envAlreadyExisted) {
    overwriteEnv = options.yes
      ? false
      : canPrompt && (await promptOverwriteEnv(envPath));
  }

  const envOverrides = {};
  for (const [optionName, envVar] of Object.entries(OPTION_TO_ENV_VAR)) {
    if (options[optionName] !== undefined)
      envOverrides[envVar] = options[optionName];
  }

  const view = await initRepo({
    dir,
    envOverrides,
    overwriteEnv,
    outDir: options.outDir,
    storeDir: options.storeDir,
  });

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + "\n");
    return;
  }
  printInitView(view);
}

module.exports = { cmdInit };
