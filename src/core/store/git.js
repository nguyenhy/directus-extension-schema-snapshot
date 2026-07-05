const path = require('path');
const { spawnGitCatFileBatch } = require('../platform/proc');
const { simpleGit } = require('simple-git');
const platformFs = require('../platform/fs');
const { writeTreeDelta, readTreeFromDir } = require('../../utils/fsTree');
const { SourceNotFoundError, NoVersionsError } = require('../errors');

// Fixed filename for the raw, pre-normalize source (see set()/getRaw()) —
// lives at the repo root, alongside the per-entity "kind/name.json" files
// writeTreeToDir() produces, so both are committed together in one tree.
const RAW_SOURCE_FILE = '_source.json';

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
    const child = spawnGitCatFileBatch(dir);
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
    platformFs.mkdir(dir);
    this.git = simpleGit(dir);
  }

  /** Ensures dir is a git repo. Safe to call repeatedly. */
  async init() {
    // checkIsRepo() returns true if inside ANY parent git repo — can't use it.
    // Check for own .git/ instead so we always init the store's own repo.
    const hasOwnGit = platformFs.exists(path.join(this.dir, '.git'));
    if (!hasOwnGit) {
      await this.git.init();
    }
  }

  /**
   * Wipes this store's directory entirely (including .git) and
   * reinitializes it empty — see store.js's `reset` contract doc for why
   * this is safe here (rebuildable cache) and unsafe in general. Only
   * caller today is core/operations/sync.js.
   * @returns {Promise<void>}
   */
  async reset() {
    platformFs.remove(this.dir);
    platformFs.mkdir(this.dir);
    this.git = simpleGit(this.dir);
    await this.init();
  }

  /**
   * Path for a readMeta()/writeMeta() sidecar blob — kept alongside this
   * store's dir (a sibling, not inside it, so reset()'s rm -rf never
   * touches it) rather than inside the git-tracked working tree, since
   * this data isn't part of version history.
   * @param {string} key
   * @returns {string}
   */
  metaPath(key) {
    return path.join(path.dirname(this.dir), `${key}.json`);
  }

  /**
   * Reads a sidecar JSON blob written by writeMeta(). Returns null if the
   * key has never been written.
   * @param {string} key
   * @returns {Promise<object | null>}
   */
  async readMeta(key) {
    const p = this.metaPath(key);
    if (!platformFs.exists(p)) return null;
    return JSON.parse(platformFs.readFile(p));
  }

  /**
   * Writes (overwrites) a sidecar JSON blob outside version history.
   * @param {string} key
   * @param {object} data
   * @returns {Promise<void>}
   */
  async writeMeta(key, data) {
    const p = this.metaPath(key);
    platformFs.mkdir(path.dirname(p));
    platformFs.writeFile(p, JSON.stringify(data, null, 2));
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
   * Returns a commit's depth (count of commits reachable from it) — used
   * to auto-sort diff args by actual commit-graph position, not wall-clock
   * time. GOTCHA: commit timestamps (`%at`) only have 1-second resolution,
   * so two commits made within the same second compare equal and a
   * timestamp-based sort silently falls back to argument order, breaking
   * diffVersions(a,b) === diffVersions(b,a). Depth via `rev-list --count`
   * is exact regardless of timing, because every commit in this store has
   * a single parent (see set() — always a full-tree linear commit).
   * @param {string} id - commit SHA (full or short)
   * @returns {Promise<number>}
   */
  async commitDepth(id) {
    const raw = await this.git.raw(['rev-list', '--count', id]);
    return parseInt(raw.trim(), 10);
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
      // Entity files always live in a "<kind>/<index>.json" subpath; anything
      // at repo root (RAW_SOURCE_FILE, map.json) is a sidecar, not an entity.
      .filter((e) => e.filePath.endsWith('.json') && e.filePath.includes('/') && e.filePath !== RAW_SOURCE_FILE);

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
   * Diffs two committed versions. Auto-sorts by commit-graph depth (see
   * commitDepth()) so diffVersions(new, old) === diffVersions(old, new) —
   * always old→new.
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
    const [depthA, depthB] = await Promise.all([this.commitDepth(idA), this.commitDepth(idB)]);
    const [idOld, idNew] = depthA <= depthB ? [idA, idB] : [idB, idA];
    const [treeOld, treeNew] = await Promise.all([this.get(idOld), this.get(idNew)]);
    return { result: diff(treeOld, treeNew), treeOld, treeNew, idOld, idNew };
  }

  /**
   * Commits a new version. First commit in an empty repo is the base
   * version; every commit after that is still a full tree (git computes
   * the diff internally, nothing here needs to know or care).
   * @param {import('../normalizers').EntityTree} tree
   * @param {string} [message]
   * @param {object} [raw] - the original, pre-normalize parsed source
   *   (e.g. what `parse(inputPath)` returned before `normalize()` ran).
   *   Stored verbatim as `_source.json` in the same commit, so getRaw()
   *   can return it later with no reconstruction/denormalize step. Omit
   *   to commit a version with no raw source retrievable via getRaw().
   * @returns {Promise<{id: string, message: string, previousTree: import('../normalizers').EntityTree}>}
   *   previousTree is what was in the working dir before this commit —
   *   {} for the first-ever commit — handed back so callers can print a
   *   diff summary without a second read.
   */
  async set(tree, message, raw) {
    await this.init();
    const previousTree = readTreeFromDir(this.dir);
    writeTreeDelta(tree, previousTree, this.dir);
    if (raw !== undefined) {
      platformFs.writeFile(path.join(this.dir, RAW_SOURCE_FILE), JSON.stringify(raw, null, 2));
    }
    await this.git.add('.');
    const summary = await this.git.commit(message || '(no message)', { '--allow-empty': null });
    return { id: summary.commit, message: message || '(no message)', previousTree };
  }

  /**
   * Returns the raw source exactly as passed to set()'s `raw` argument for
   * this version — a direct `git show <id>:_source.json` read, no tree
   * reconstruction, no denormalize, no merge (contrast with get(), which
   * reassembles the normalized EntityTree from per-entity files).
   * @param {string} id - commit SHA (full or unambiguous prefix)
   * @returns {Promise<object>}
   * @throws {Error} "No raw source stored for commit <id>" if this
   *   version was committed without a `raw` argument (e.g. before this
   *   capability existed).
   */
  async getRaw(id) {
    await this.init();
    let content;
    try {
      content = await this.git.show([`${id}:${RAW_SOURCE_FILE}`]);
    } catch {
      throw new SourceNotFoundError(`No raw source stored for commit ${id}`);
    }
    return JSON.parse(content);
  }

  /**
   * Removes the most recently committed version via `git revert` — safe
   * by construction: creates a new commit undoing the last one, nothing
   * is deleted or rewritten. Every prior version stays reachable via
   * get()/list() exactly as before, including the one just "removed"
   * (its tree is still readable at its original commit id).
   * @param {string} [message] - commit message override. When omitted,
   *   falls back to an auto-built "Remove version <shortId> (N added, N
   *   modified, N removed)" summary. core/operations/remove.js passes the
   *   `remove: eN (removes eM)` form (see eventLog.js's
   *   formatRemoveMessage) when a meta.json tombstone was written for this
   *   removal, so `list` can label the row instead of showing "-".
   * @returns {Promise<{id: string, revertedId: string, previousTree: import('../normalizers').EntityTree, tree: import('../normalizers').EntityTree}>}
   *   previousTree is the version being undone; tree is the resulting
   *   (now-current) version after the revert.
   * @throws {Error} "No versions to remove" if the store has no commits yet
   */
  async removeLatest(message) {
    await this.init();
    const versions = await this.list();
    if (versions.length === 0) {
      throw new NoVersionsError('No versions to remove');
    }
    const revertedId = versions[0].id;
    const previousTree = await this.get(revertedId);

    // --no-commit instead of --no-edit: git's auto-generated revert message
    // is `Revert "<original commit message>"`, which names nothing useful
    // when the original message was blank (the common case here). Commit
    // it ourselves instead — either the caller's message, or a fallback
    // that names the actual hash removed plus what changed, so
    // `list`/reflog-free history stays informative either way.
    await this.git.raw(['revert', '--no-commit', 'HEAD']);
    const tree = readTreeFromDir(this.dir);

    const { diff } = require('../diff');
    const { added, modified, removed } = diff(previousTree, tree);
    const commitMessage =
      message || `Remove version ${revertedId.slice(0, 7)} (${added.length} added, ${modified.length} modified, ${removed.length} removed)`;

    await this.git.add('.');
    const summary = await this.git.commit(commitMessage, { '--allow-empty': null });
    return { id: summary.commit, revertedId, previousTree, tree };
  }
}

module.exports = { GitStore };
