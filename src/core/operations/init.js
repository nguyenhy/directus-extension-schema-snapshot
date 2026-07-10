const path = require('path');
const platformFs = require('../platform/fs');
const { buildInitView } = require('../present/init');
const { DirectoryNotEmptyError } = require('../errors');
const { PACKAGE_ROOT } = require('../../packageRoot');
const { META_FILE, SOURCE_DIR } = require('../snapshotSync/eventLog');
const { DEFAULT_SNAPSHOTS_DIR } = require('../defaults');
const {
  ENV_VAR_OUT_DIR,
  ENV_VAR_TYPE,
  ENV_VAR_SUBDIR_FORMAT,
  ENV_VAR_STORE_DIR,
  ENV_VAR_STORE_TYPE,
  ENV_VAR_FILE_FORMAT,
  ENV_VAR_SNAPSHOTS_DIR,
} = require('../envVars');

// Bundled template shipped with this package's own root, not the target dir.
const ENV_EXAMPLE_SRC = path.join(PACKAGE_ROOT, '.env.schema-snapshot.example');

// Own-namespaced env filename — deliberately NOT `.env`, so init never
// touches/collides with a host project's real `.env` (see config.js's
// resolveEnvFile(), which reads this same name, falling back to `.env`
// only if this file doesn't exist).
const ENV_FILENAME = '.env.schema-snapshot';

// OS/editor junk that never counts as real content anywhere init inspects.
const IGNORABLE_ENTRIES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini', '.gitkeep']);

// The only entries a schema-snapshots/ dir can contain and still be a
// valid, reusable event log (see docs/proposal-schema-snapshot-sync.md §2
// and core/snapshotSync/eventLog.js's module header for the layout).
const RECOGNIZED_SNAPSHOTS_ENTRIES = new Set([META_FILE, SOURCE_DIR]);


// Every SCHEMA_SNAPSHOT_* var the template declares uncommented — the set
// `init`'s CLI flags are allowed to override at scaffold time. Keep in
// sync with .env.schema-snapshot.example / src/config.js's envOr() calls.
const OVERRIDABLE_VARS = [
  ENV_VAR_OUT_DIR,
  ENV_VAR_TYPE,
  ENV_VAR_SUBDIR_FORMAT,
  ENV_VAR_STORE_DIR,
  ENV_VAR_STORE_TYPE,
  ENV_VAR_FILE_FORMAT,
  ENV_VAR_SNAPSHOTS_DIR,
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
 * Resolves `<envRoot>/.env.schema-snapshot` for `dir` and reports whether
 * it already exists — lets a caller (e.g. `cmdInit`) decide how to handle
 * a pre-existing file (prompt to overwrite, or leave it) BEFORE `initRepo`
 * runs, since `initRepo` itself only ever writes, never asks.
 * @param {string} dir - target directory
 * @returns {{envPath: string, exists: boolean}}
 */
function checkEnvFile(dir) {
  const envPath = path.join(findEnvRoot(dir), ENV_FILENAME);
  return { envPath, exists: platformFs.exists(envPath) };
}

/**
 * Classifies `<dir>/<snapshotsDirName>` for init purposes — the only
 * content `init` still validates (see checkInitConflict's doc for why
 * OUT_DIR/STORE_DIR are no longer checked here at all).
 * - 'missing': doesn't exist, or exists but has nothing beyond OS junk —
 *   safe for init to leave untouched; a later `add`/`sync` creates it.
 * - 'existing': contains only recognized event-log entries (`meta.json`,
 *   `source/`) from a prior `add`/`sync` — a valid schema-snapshots dir
 *   already; safe to reuse as-is, not a conflict. This is what makes
 *   "init after init" idempotent instead of an error.
 * - 'conflict': contains something else — ambiguous enough that a later
 *   `sync` could write `meta.json` into an unrelated, occupied dir the
 *   user pointed init at by mistake.
 * @param {string} dir
 * @param {string} snapshotsDirName
 * @returns {{status: 'missing'|'existing'|'conflict', path: string, foreign?: string[]}}
 */
function classifySnapshotsDir(dir, snapshotsDirName) {
  const snapshotsPath = path.join(dir, snapshotsDirName);
  if (!platformFs.exists(snapshotsPath)) return { status: 'missing', path: snapshotsPath };

  const entries = platformFs.readdir(snapshotsPath).filter((entry) => !IGNORABLE_ENTRIES.has(entry));
  if (entries.length === 0) return { status: 'missing', path: snapshotsPath };

  const foreign = entries.filter((entry) => !RECOGNIZED_SNAPSHOTS_ENTRIES.has(entry));
  if (foreign.length > 0) return { status: 'conflict', path: snapshotsPath, foreign };

  return { status: 'existing', path: snapshotsPath };
}

/**
 * Validates a target dir is safe to `init` into. `SCHEMA_SNAPSHOT_OUT_DIR`
 * and `SCHEMA_SNAPSHOT_STORE_DIR` are deliberately NOT checked: both live
 * under the gitignored `.snapshot/` cache, which every downstream command
 * that touches it (`add`, `normalize`, `sync`, `list`) already tolerates
 * pre-existing content in — `GitStore.init()` is itself idempotent (checks
 * its own `.git`, no-op if present), and `normalize`'s `runSubDir` always
 * writes a fresh timestamped subdir, never collides. Blocking `init` on
 * either would be stricter than the commands it's protecting.
 *
 * `SCHEMA_SNAPSHOT_SNAPSHOTS_DIR` (schema-snapshots/) is the one directory
 * `init` still validates: it's host-repo-committed (not gitignored) and
 * has real structure a `sync` could corrupt if occupied by something
 * unrelated — see classifySnapshotsDir's doc. A dir with a *valid* prior
 * event log is not a conflict, only truly foreign content is.
 * @param {string} dir - target directory
 * @param {string} [snapshotsDirName] - value of SCHEMA_SNAPSHOT_SNAPSHOTS_DIR to check, relative to `dir`
 */
function assertReadyForInit(dir, snapshotsDirName) {
  const err = checkInitConflict(dir, snapshotsDirName);
  if (err) throw err;
}

/**
 * Same check as `assertReadyForInit`, but returns the conflict instead of
 * throwing it — lets a caller (e.g. `cmdInit`) decide whether to prompt
 * for an override instead of dying immediately. `assertReadyForInit`
 * stays the throwing form so existing callers/tests are unaffected.
 * @param {string} dir - target directory
 * @param {string} [snapshotsDirName] - defaults to config's default ('schema-snapshots')
 * @returns {DirectoryNotEmptyError|null} the conflict, or `null` if `dir`
 *   is ready for `initRepo` (including the idempotent "already has a
 *   valid event log" case, which is never a conflict)
 */
function checkInitConflict(dir, snapshotsDirName = DEFAULT_SNAPSHOTS_DIR) {
  platformFs.mkdir(dir);

  const classified = classifySnapshotsDir(dir, snapshotsDirName);
  if (classified.status === 'conflict') {
    return new DirectoryNotEmptyError(
      `"${classified.path}" is not empty (found: ${classified.foreign.join(', ')}) and isn't a recognized schema-snapshots event log. ` +
        'init requires it to be empty, absent, or already a valid schema-snapshots dir.'
    );
  }

  return null;
}

/**
 * Resolves the `.gitignore` entry for `target` (an OUT_DIR/STORE_DIR
 * value, absolute or relative to `dir`) relative to `dir` itself —
 * `.gitignore` only has meaning for paths inside the repo it lives in.
 * @param {string} dir - target directory being initialized (the .gitignore's location)
 * @param {string} target - OUT_DIR or STORE_DIR value, as configured
 * @returns {string|null} POSIX-style relative entry with trailing slash,
 *   or `null` if `target` resolves outside `dir` (e.g. an absolute path
 *   elsewhere, like `--out-dir ~/Doc/out`) — gitignoring it would be a
 *   no-op there and misleading to write into `dir`'s own `.gitignore`.
 */
function gitignoreEntryFor(dir, target) {
  const resolvedDir = path.resolve(dir);
  const resolvedTarget = path.resolve(dir, target);
  const rel = path.relative(resolvedDir, resolvedTarget);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/') + '/';
}

/**
 * Ensures each of `lines` is present in `<dir>/.gitignore`, appending only
 * the missing ones — never overwrites. A target `dir` may already have a
 * real `.gitignore` (it's often a project root), and a blind overwrite
 * would destroy it; init only ever ADDS to it.
 * @param {string} gitignorePath - absolute path to the target .gitignore
 * @param {string[]} lines - entries to ensure are present
 * @returns {boolean} true if the file was created or a line was appended
 */
function appendGitignoreLines(gitignorePath, lines) {
  const exists = platformFs.exists(gitignorePath);
  const existing = exists ? platformFs.readFile(gitignorePath) : '';
  const existingLines = new Set(existing.split('\n').map((line) => line.trim()));
  const missing = lines.filter((line) => !existingLines.has(line));
  if (missing.length === 0) return false;

  const needsNewline = existing.length > 0 && !existing.endsWith('\n');
  const addition = (needsNewline ? '\n' : '') + missing.join('\n') + '\n';
  platformFs.appendFile(gitignorePath, addition);
  return true;
}

/**
 * Sets up a target directory for schema-snapshot use: copies the bundled
 * `.env.schema-snapshot.example` to `<envRoot>/.env.schema-snapshot` (see
 * findEnvRoot — a nested `dir` inside an existing package.json project
 * gets it at that project's root; a standalone `dir` gets its own), and
 * writes `<dir>/.gitignore`. That's the entire scope of `init` now — it
 * no longer touches `.snapshot/` (OUT_DIR/STORE_DIR) or constructs a
 * Store; those are created lazily and idempotently by the first `add`.
 *
 * If `.env.schema-snapshot` already exists at the resolved env root, it's
 * left alone unless `overwriteEnv` is passed — see `cmdInit`, which
 * decides that via a user prompt/`--yes` before calling this.
 *
 * Caller must call `assertReadyForInit(dir, snapshotsDirName)` first (see
 * that function's doc) to validate the schema-snapshots/ target.
 * @param {{dir: string, outDir: string, storeDir: string, envOverrides?: Object<string, string>, overwriteEnv?: boolean}} params
 *   `envOverrides` — `{SCHEMA_SNAPSHOT_X: value}` pairs (see
 *   OVERRIDABLE_VARS) written into the scaffolded env file in place of
 *   the template's defaults; unrecognized keys are ignored.
 *   `overwriteEnv` — if true and the env file already exists, rewrite it
 *   from the template anyway (default: leave it untouched).
 *   `outDir`/`storeDir` — required, no default here: the actual
 *   configured SCHEMA_SNAPSHOT_OUT_DIR / SCHEMA_SNAPSHOT_STORE_DIR values
 *   — `cmdInit` always has these (commander bakes config.js's defaults
 *   into the option defaults, see cli/index.js), so there's no case where
 *   the real caller doesn't have a value; a second hardcoded default here
 *   would just be a copy of config.js's that could drift. Only the ones
 *   that resolve INSIDE `dir` get a `.gitignore` entry; see
 *   gitignoreEntryFor's doc for why an `--out-dir` pointed elsewhere
 *   (e.g. `~/Doc/out`) is skipped.
 * @returns {Promise<ReturnType<typeof buildInitView>>}
 */
async function initRepo({ dir, outDir, storeDir, envOverrides = {}, overwriteEnv = false }) {
  platformFs.mkdir(dir);
  const { envPath, exists: envAlreadyExisted } = checkEnvFile(dir);
  const writeEnv = !envAlreadyExisted || overwriteEnv;
  if (writeEnv) {
    const template = platformFs.readFile(ENV_EXAMPLE_SRC);
    platformFs.writeFile(envPath, renderEnvContent(template, envOverrides));
  }

  const gitignoreLines = [...new Set([gitignoreEntryFor(dir, outDir), gitignoreEntryFor(dir, storeDir)].filter(Boolean))];
  const gitignorePath = path.join(path.resolve(dir), '.gitignore');
  const gitignoreChanged = gitignoreLines.length > 0 && appendGitignoreLines(gitignorePath, gitignoreLines);

  return buildInitView({
    dir,
    envPath,
    envCreated: writeEnv,
    envReused: envAlreadyExisted && !writeEnv,
    filesCreated: [...(writeEnv ? [envPath] : []), ...(gitignoreChanged ? [gitignorePath] : [])],
  });
}

module.exports = {
  initRepo,
  assertReadyForInit,
  checkInitConflict,
  checkEnvFile,
  findEnvRoot,
  renderEnvContent,
  OVERRIDABLE_VARS,
  ENV_FILENAME,
};
