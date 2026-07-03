const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const { writeTreeToDir, readTreeFromDir } = require('../../utils/fsTree');

/**
 * Removes everything in dir except .git, so a fresh writeTreeToDir() call
 * accurately reflects removed entities too (git then sees them as deleted
 * files, not just files git add -A happens to ignore).
 * @param {string} dir
 */
function clearWorkingTree(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    if (entry === '.git') continue;
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}

/**
 * Git-backed Store: every version is a full commit of the normalized tree,
 * not a delta — reading any version is a direct read (git show/checkout),
 * never a chain-walk or replay. See docs/architecture.md#store for the
 * rationale (this mirrors git's own object model, deliberately).
 */
class GitStore {
  /** @param {string} dir - where the git repo lives, e.g. ".snapshot/repo" */
  constructor(dir) {
    this.dir = dir;
    // simple-git requires the directory to exist at construction time.
    fs.mkdirSync(dir, { recursive: true });
    this.git = simpleGit(dir);
  }

  /** Ensures dir is a git repo. Safe to call repeatedly. */
  async init() {
    // checkIsRepo() returns true if inside ANY parent git repo — can't use it.
    // Check for own .git/ instead so we always init the store's own repo.
    const hasOwnGit = fs.existsSync(path.join(this.dir, '.git'));
    if (!hasOwnGit) {
      await this.git.init();
    }
  }

  /**
   * Returns all committed versions, newest first.
   * Returns [] when the repo has no commits yet.
   * @returns {Promise<{id: string, timestamp: string, message: string}[]>}
   */
  async list() {
    await this.init();
    let log;
    try {
      log = await this.git.log();
    } catch {
      // no commits yet — simple-git throws on empty repos
      return [];
    }
    if (!log || !log.all || log.all.length === 0) return [];
    return log.all.map((entry) => ({
      id: entry.hash,
      timestamp: entry.date,
      message: entry.message,
    }));
  }

  /**
   * Reads the full EntityTree for a given commit id (short or full SHA).
   * Reconstructs directly from git objects — no checkout, no temp dir.
   * Path shape in the store is "kind/name.json" (written by writeTreeToDir),
   * which maps back to entityKey format "kind:name".
   * @param {string} id - commit SHA (full or unambiguous prefix)
   * @returns {Promise<import('../normalizers').EntityTree>}
   * @throws if id doesn't resolve to a commit in this store
   */
  async get(id) {
    await this.init();
    const rawFiles = await this.git.raw(['ls-tree', '-r', '--name-only', id]);
    const files = rawFiles.trim().split('\n').filter((f) => f.endsWith('.json'));
    const tree = {};
    for (const filePath of files) {
      const content = await this.git.show([`${id}:${filePath}`]);
      const slashIdx = filePath.indexOf('/');
      const kind = filePath.slice(0, slashIdx);
      const name = filePath.slice(slashIdx + 1, -'.json'.length);
      tree[`${kind}:${name}`] = JSON.parse(content);
    }
    return tree;
  }

  /**
   * Commits a new version. First commit in an empty repo is the base
   * version; every commit after that is still a full tree (git computes
   * the diff internally, nothing here needs to know or care).
   * @param {import('../normalizers').EntityTree} tree
   * @param {string} [message]
   * @returns {Promise<{id: string, message: string, previousTree: import('../normalizers').EntityTree}>}
   *   previousTree is what was in the working dir before this commit —
   *   {} for the first-ever commit — handed back so callers can print a
   *   diff summary without a second read.
   */
  async set(tree, message) {
    await this.init();
    const previousTree = readTreeFromDir(this.dir);
    clearWorkingTree(this.dir);
    writeTreeToDir(tree, this.dir);
    await this.git.add('.');
    const summary = await this.git.commit(message || '(no message)', { '--allow-empty': null });
    return { id: summary.commit, message: message || '(no message)', previousTree };
  }
}

module.exports = { GitStore };
