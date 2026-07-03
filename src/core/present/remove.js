const { diff } = require('../diff');
const { buildDiffView } = require('./diff');

/**
 * Builds a render-agnostic view of a `remove --latest` result — the
 * revert-commit id plus the same diff view `add`/`diff`/`show` consume.
 * @param {string} id - new commit SHA (the revert commit)
 * @param {string} revertedId - commit SHA of the version that was undone
 * @param {import('../normalizers').EntityTree} previousTree - version undone
 * @param {import('../normalizers').EntityTree} tree - resulting (now-current) version
 * @returns {{id: string, shortId: string, revertedId: string, revertedShortId: string, diff: ReturnType<typeof buildDiffView>}}
 */
function buildRemoveView(id, revertedId, previousTree, tree) {
  const result = diff(previousTree, tree);
  return {
    id,
    shortId: id.slice(0, 7),
    revertedId,
    revertedShortId: revertedId.slice(0, 7),
    diff: buildDiffView(result, previousTree, tree),
  };
}

module.exports = { buildRemoveView };
