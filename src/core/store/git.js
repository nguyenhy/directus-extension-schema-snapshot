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
    const isRepo = await this.git.checkIsRepo();
    if (!isRepo) {
      await this.git.init();
    }
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
