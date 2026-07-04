const { spawn } = require('child_process');

/**
 * Spawns `git cat-file --batch` in `dir`, streaming multiple blobs through
 * one long-lived process (see GitStore.get()'s batchCatFile, the only
 * caller). Sole child_process touchpoint in the codebase — any other
 * spawn need should be added here as its own named function, not by
 * importing child_process elsewhere.
 * @param {string} dir - repo dir to run the process in
 * @returns {import('child_process').ChildProcess}
 */
const spawnGitCatFileBatch = (dir) => spawn('git', ['cat-file', '--batch'], { cwd: dir });

module.exports = { spawnGitCatFileBatch };
