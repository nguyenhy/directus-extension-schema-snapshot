const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const simpleGit = require('simple-git');
const { writeTreeToDir, readTreeFromDir } = require('../../utils/fsTree');

/**
 * Reads multiple blobs from a repo in one `git cat-file --batch` process,
 * instead of one `git show` spawn per blob (see GitStore.get()).
 * @param {string} dir - repo dir
 * @param {string[]} shas - blob SHAs to read, in order
 * @returns {Promise<string[]>} blob contents, same order as shas
 */
function batchCatFile(dir, shas) {
  return new Promise((resolve, reject) => {
    if (shas.length === 0) return resolve([]);
    const child = spawn('git', ['cat-file', '--batch'], { cwd: dir });
    let buf = Buffer.alloc(0);
    const results = [];
    child.stdout.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (true) {
        const headerEnd = buf.indexOf('\n');
        if (headerEnd === -1) break;
        const header = buf.slice(0, headerEnd).toString();
        const parts = header.split(' ');
        const size = parseInt(parts[parts.length - 1], 10);
        if (isNaN(size)) break; // e.g. "<sha> missing" — shouldn't happen for tree-listed blobs
        const contentStart = headerEnd + 1;
        const contentEnd = contentStart + size;
        if (buf.length < contentEnd + 1) break; // wait for full content + trailing \n
        results.push(buf.slice(contentStart, contentEnd).toString('utf8'));
        buf = buf.slice(contentEnd + 1);
      }
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0 && results.length !== shas.length) {
        return reject(new Error(`git cat-file --batch exited with code ${code}`));
      }
      resolve(results);
    });
    child.stdin.write(shas.join('\n') + '\n');
    child.stdin.end();
  });
}

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
   * Returns the unix timestamp (ms) of a commit. Used to auto-sort diff args.
   * Returns null if id is not a store version (e.g. it's a file path).
   * @param {string} id - commit SHA (full or short)
   * @returns {Promise<number|null>}
   */
  async commitTime(id) {
    try {
      const raw = await this.git.raw(['log', '-1', '--format=%at', id]);
      const secs = parseInt(raw.trim(), 10);
      return isNaN(secs) ? null : secs * 1000;
    } catch {
      return null;
    }
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
    const rawEntries = await this.git.raw(['ls-tree', '-r', id]);
    // "<mode> blob <sha>\t<path>" per line
    const entries = rawEntries
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const tabIdx = line.indexOf('\t');
        const filePath = line.slice(tabIdx + 1);
        const sha = line.slice(0, tabIdx).split(' ')[2];
        return { filePath, sha };
      })
      .filter((e) => e.filePath.endsWith('.json'));

    const contents = await batchCatFile(this.dir, entries.map((e) => e.sha));

    const tree = {};
    entries.forEach(({ filePath }, i) => {
      const slashIdx = filePath.indexOf('/');
      const kind = filePath.slice(0, slashIdx);
      const name = filePath.slice(slashIdx + 1, -'.json'.length);
      tree[`${kind}:${name}`] = JSON.parse(contents[i]);
    });
    return tree;
  }

  /**
   * Diffs two committed versions. Auto-sorts by commit timestamp so
   * diffVersions(new, old) === diffVersions(old, new) — always old→new.
   * @param {string} idA - commit SHA (full or short)
   * @param {string} idB - commit SHA (full or short)
   * @returns {Promise<{
   *   result: import('../diff').DiffResult,
   *   treeOld: import('../normalizers').EntityTree,
   *   treeNew: import('../normalizers').EntityTree,
   *   idOld: string,
   *   idNew: string,
   * }>}
   */
  async diffVersions(idA, idB) {
    const { diff } = require('../diff');
    const [timeA, timeB] = await Promise.all([this.commitTime(idA), this.commitTime(idB)]);
    const [idOld, idNew] = timeA <= timeB ? [idA, idB] : [idB, idA];
    const [treeOld, treeNew] = await Promise.all([this.get(idOld), this.get(idNew)]);
    return { result: diff(treeOld, treeNew), treeOld, treeNew, idOld, idNew };
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
