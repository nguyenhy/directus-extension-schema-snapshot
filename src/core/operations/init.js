const path = require('path');
const platformFs = require('../platform/fs');
const { buildInitView } = require('../present/init');
const { AlreadyInitializedError, DirectoryNotEmptyError } = require('../errors');
const { PACKAGE_ROOT } = require('../../packageRoot');

// Bundled template shipped with this package's own root, not the target dir.
const ENV_EXAMPLE_SRC = path.join(PACKAGE_ROOT, '.env.schema-snapshot.example');

// Own-namespaced env filename — deliberately NOT `.env`, so init never
// touches/collides with a host project's real `.env` (see config.js's
// resolveEnvFile(), which reads this same name, falling back to `.env`
// only if this file doesn't exist).
const ENV_FILENAME = '.env.schema-snapshot';

// Files that a target dir may already contain without being considered
// "non-empty" — OS/editor junk, plus `.env`/`.env.schema-snapshot`/
// `package.json` which may legitimately preexist (dir is itself a
// project root) without meaning schema-snapshot was already set up there.
const IGNORABLE_ENTRIES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini', '.gitkeep', '.env', ENV_FILENAME, 'package.json']);

// Presence of either of these in the target dir means a previous `init`
// (or manual `add`/`sync` setup) already happened there. `.env` is
// deliberately NOT here — see findEnvRoot()/initRepo(): a `.env` may
// belong to an unrelated host project at the resolved env root and
// existing there doesn't mean schema-snapshot itself was ever set up.
const ALREADY_INIT_MARKERS = ['schema-snapshots', '.snapshot'];

const GITIGNORE_LINES = ['.snapshot/'];

// Every SCHEMA_SNAPSHOT_* var the template declares uncommented — the set
// `init`'s CLI flags are allowed to override at scaffold time. Keep in
// sync with .env.schema-snapshot.example / src/config.js's envOr() calls.
const OVERRIDABLE_VARS = [
  'SCHEMA_SNAPSHOT_OUT_DIR',
  'SCHEMA_SNAPSHOT_TYPE',
  'SCHEMA_SNAPSHOT_SUBDIR_FORMAT',
  'SCHEMA_SNAPSHOT_STORE_DIR',
  'SCHEMA_SNAPSHOT_STORE_TYPE',
  'SCHEMA_SNAPSHOT_FILE_FORMAT',
  'SCHEMA_SNAPSHOT_SNAPSHOTS_DIR',
];

/**
 * Applies `{VAR: value}` overrides to the template's `VAR=...` lines,
 * leaving comments and untouched vars as-is. Only vars in
 * OVERRIDABLE_VARS are ever looked at — anything else in `overrides` is
 * silently ignored (defensive, in case a caller passes an unrelated
 * options object through instead of a pre-filtered one).
 * @param {string} templateContent
 * @param {Object<string, string>} overrides
 * @returns {string}
 */
function renderEnvContent(templateContent, overrides) {
  let content = templateContent;
  for (const key of OVERRIDABLE_VARS) {
    const value = overrides[key];
    if (value === undefined) continue;
    const line = new RegExp(`^${key}=.*$`, 'm');
    content = content.replace(line, `${key}=${value}`);
  }
  return content;
}

/**
 * Finds where `.env.schema-snapshot` should live for a target `dir`: the nearest
 * ancestor (including `dir` itself) containing a `package.json`, since
 * that's the project root a Node tool's `.env` conventionally sits next
 * to — matching how a user would `cd` there and run commands without
 * `--env-file`. Falls back to `dir` itself if no `package.json` is found
 * walking up to the filesystem root (e.g. `dir` is a brand-new location
 * with no enclosing project).
 * @param {string} dir - target directory (may be relative)
 * @returns {string} absolute path to the resolved env root
 */
function findEnvRoot(dir) {
  let current = path.resolve(dir);
  while (true) {
    if (platformFs.exists(path.join(current, 'package.json'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(dir); // hit fs root, nothing found
    current = parent;
  }
}

/**
 * Validates a target dir is safe to `init` into — must run BEFORE the
 * caller constructs a Store for `dir` (e.g. via createEnv), since
 * GitStore's constructor eagerly `mkdir`s its storeDir as a side effect;
 * constructing it first would create `<dir>/.snapshot/...` and make the
 * dir look non-empty to this very check.
 *
 * Rejects if the dir already looks initialized (has `schema-snapshots/`
 * or `.snapshot/`) — `init` is a one-time setup, not an idempotent sync.
 * Also rejects if the dir has other content already,
 * since silently mixing schema-snapshot scaffolding into an unrelated
 * populated dir is more likely a mistake than intent. OS junk files
 * (`.DS_Store`, etc, see IGNORABLE_ENTRIES) don't count against emptiness.
 * @param {string} dir - target directory
 */
function assertReadyForInit(dir) {
  platformFs.mkdir(dir);

  const marker = ALREADY_INIT_MARKERS.find((entry) => platformFs.exists(path.join(dir, entry)));
  if (marker) {
    throw new AlreadyInitializedError(`"${dir}" is already initialized (found "${marker}"). Run schema-snapshot commands directly, or choose an empty target dir.`);
  }

  const existing = platformFs.readdir(dir).filter((entry) => !IGNORABLE_ENTRIES.has(entry));
  if (existing.length > 0) {
    throw new DirectoryNotEmptyError(`"${dir}" is not empty (found: ${existing.join(', ')}). init requires an empty target dir.`);
  }
}

/**
 * Sets up a target directory for schema-snapshot use: copies the bundled
 * `.env.schema-snapshot.example` to `<envRoot>/.env.schema-snapshot` (see findEnvRoot —
 * a nested `dir` inside an existing package.json project gets it at that
 * project's root; a standalone `dir` gets its own), appends the store
 * cache dir to `<dir>/.gitignore`, and initializes the local GitStore
 * cache — the "one command instead of five manual steps" onboarding
 * path. Using `.env.schema-snapshot` instead of `.env` means init never
 * touches a host project's real `.env`.
 *
 * If `.env.schema-snapshot` already exists at the resolved env root,
 * it's left alone (not overwritten, `envOverrides` ignored too) — most
 * likely a prior `init` run; re-run against an empty dir to apply new
 * overrides instead.
 *
 * Caller must call `assertReadyForInit(dir)` before constructing `store`
 * (see that function's doc) — this function assumes that already passed
 * and does not re-check, since by the time `store` exists here the
 * constructor's mkdir side effect has already happened.
 * @param {{dir: string, store: import('../store/store').Store, envOverrides?: Object<string, string>}} params
 *   `store` is injected the same way every other core/operations/*.js
 *   takes it — constructed once by createEnv(), never `new GitStore()`
 *   here. `envOverrides` — `{SCHEMA_SNAPSHOT_X: value}` pairs (see
 *   OVERRIDABLE_VARS) written into the freshly-scaffolded env file in
 *   place of the template's defaults; unrecognized keys are ignored.
 * @returns {Promise<ReturnType<typeof buildInitView>>}
 */
async function initRepo({ dir, store, envOverrides = {} }) {
  const envRoot = findEnvRoot(dir);
  const envPath = path.join(envRoot, ENV_FILENAME);
  const envAlreadyExisted = platformFs.exists(envPath);
  if (!envAlreadyExisted) {
    const template = platformFs.readFile(ENV_EXAMPLE_SRC);
    platformFs.writeFile(envPath, renderEnvContent(template, envOverrides));
  }

  const gitignorePath = path.join(dir, '.gitignore');
  platformFs.writeFile(gitignorePath, GITIGNORE_LINES.join('\n') + '\n');

  await store.init();

  return buildInitView({
    dir,
    envPath,
    envCreated: !envAlreadyExisted,
    filesCreated: [...(envAlreadyExisted ? [] : [envPath]), gitignorePath],
  });
}

module.exports = { initRepo, assertReadyForInit, findEnvRoot, renderEnvContent, OVERRIDABLE_VARS };
