/**
 * Builds a render-agnostic view of a completed `normalize` write-to-disk run.
 * @param {import('../normalizers').EntityTree} tree
 * @param {string} dir - output directory the run was written to
 * @returns {{entityCount: number, dir: string}}
 */
function buildNormalizeView(tree, dir) {
  return { entityCount: Object.keys(tree).length, dir };
}

module.exports = { buildNormalizeView };
