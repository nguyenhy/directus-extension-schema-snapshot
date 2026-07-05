const path = require('path');
const { createEnv } = require('../../core/env');
const { initRepo, assertReadyForInit } = require('../../core/operations/init');
const { printInitView } = require('../render/init');

/**
 * commander action handler for `init [dir]`.
 * `storeDir`/`snapshotsDir` are resolved relative to the target `dir`
 * (not cwd) — init is setting up `dir`, so its store should live inside
 * `dir`, matching what `.env` (copied into `dir`) will point at once the
 * user cds there.
 *
 * `assertReadyForInit` runs BEFORE `createEnv` constructs the Store —
 * GitStore's constructor eagerly `mkdir`s its storeDir, which would make
 * `dir` look non-empty to the check if done after. See that function's
 * doc in core/operations/init.js.
 * @param {string} dir - target directory argument from the CLI
 * @param {{storeDir: string, storeType: string, json?: boolean}} options - commander-parsed options
 */
async function cmdInit(dir, options) {
  assertReadyForInit(dir);
  const { store } = createEnv({ storeDir: path.join(dir, options.storeDir), storeType: options.storeType });
  const view = await initRepo({ dir, store });

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    return;
  }
  printInitView(view);
}

module.exports = { cmdInit };
