const path = require("path");
const readline = require("readline");

/**
 * Prints an init view (from core/present/init.js) as CLI text. File lines
 * show the absolute path (unambiguous, copy-pasteable); the trailing hint
 * shows just the env file's basename (dir is already stated above it).
 * @param {ReturnType<import('../../core/present/init').buildInitView>} view
 */
function printInitView(view) {
  console.log();
  console.log(`Initialized schema-snapshot in "${view.dir}".`);
  if (view.envReused) {
    console.log(`[x] ${view.envPath}`);
  } else {
    console.log(`[-] ${view.envPath}`);
  }
  for (const file of view.filesCreated) {
    if (file === view.envPath) continue;
    console.log(`[x] ${file}`);
  }

  console.log();
  console.log(`Edit "${path.basename(view.envPath)}" if needed,`);
  console.log(
    `then run \`schema-snapshot add <schema.json>\` to record your first version.`,
  );
}

/**
 * Prints an unresolved init conflict (declined override) as CLI text —
 * the message plus a pointer to manual setup steps.
 * @param {Error} conflict - the DirectoryNotEmptyError from checkInitConflict
 */
function printInitConflict(conflict) {
  console.log(`Error: ${conflict.message}`);
  console.log('See README.md "Getting started" for manual setup steps');
  console.log("- copy .env.schema-snapshot.example");
  console.log("- add .snapshot/ to .gitignore");
  console.log("- run `add`).");
}

/**
 * Prompts a y/N question on the given TTY streams. Only ever called when
 * stdin is a TTY (see cmdInit) — a piped/CI stdin has no one to answer, so
 * that path skips straight to a safe non-interactive default instead of
 * hanging on a prompt that will never resolve.
 * @param {string} message
 * @returns {Promise<boolean>}
 */
function promptYesNo(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

/**
 * Prompts to proceed past an unresolved init conflict.
 * @param {Error} conflict - the DirectoryNotEmptyError from checkInitConflict
 * @returns {Promise<boolean>}
 */
function promptProceedAnyway(conflict) {
  return promptYesNo(`${conflict.message} Proceed anyway?`);
}

/**
 * Prompts to overwrite an already-existing `.env.schema-snapshot`.
 * @param {string} envPath
 * @returns {Promise<boolean>}
 */
function promptOverwriteEnv(envPath) {
  return promptYesNo(
    [`"${envPath}" already exists.`, `Overwrite with a fresh template?`].join(
      "\n",
    ),
  );
}

module.exports = {
  printInitView,
  printInitConflict,
  promptProceedAnyway,
  promptOverwriteEnv,
};
