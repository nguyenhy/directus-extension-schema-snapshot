/**
 * Builds a render-agnostic view of an `extract` result — the mode, the
 * extracted keys, and where they were written.
 * @param {string[]} keys - entity keys extracted (added-only or removed-only)
 * @param {'added'|'removed'} mode
 * @param {string} dir - directory the partial tree was written to
 * @returns {{mode: 'added'|'removed', keys: string[], count: number, dir: string}}
 */
function buildExtractView(keys, mode, dir) {
  return { mode, keys, count: keys.length, dir };
}

module.exports = { buildExtractView };
