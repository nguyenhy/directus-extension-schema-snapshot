const { buildDiffView } = require('./diff');

/**
 * Builds a render-agnostic view of an `add` result — the confirmation
 * header plus the same diff view `diff`/`show` consume, so CLI and any
 * future UI render identical "what changed" output for a commit.
 * @param {string} id - new commit SHA
 * @param {string} message - commit message ("(no message)" if none given)
 * @param {import('../diff').DiffResult} result
 * @param {import('../normalizers').EntityTree} previousTree
 * @param {import('../normalizers').EntityTree} tree
 * @returns {{id: string, shortId: string, message: string, diff: ReturnType<typeof buildDiffView>}}
 */
function buildAddView(id, message, result, previousTree, tree) {
  return {
    id,
    shortId: id.slice(0, 7),
    message,
    diff: buildDiffView(result, previousTree, tree),
  };
}

module.exports = { buildAddView };
