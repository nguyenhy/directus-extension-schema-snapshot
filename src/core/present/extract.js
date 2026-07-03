/**
 * Builds a render-agnostic view of an `extract` result — the mode, the
 * extracted keys, and where they were written.
 * @param {string[]} keys - entity keys extracted (added-only or removed-only)
 * @param {'added'|'removed'|'modified'} mode
 * @param {string} dir - directory the partial tree was written to
 * @param {string} [file] - file the snapshot was written to (if snapshot mode)
 * @returns {{mode: 'added'|'removed'|'modified', keys: string[], count: number, dir: string, file?: string}}
 */
function buildExtractView(keys, mode, dir, file) {
  return { mode, keys, count: keys.length, dir, file };
}

module.exports = { buildExtractView };

