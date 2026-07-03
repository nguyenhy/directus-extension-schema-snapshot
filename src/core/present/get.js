/**
 * Builds a render-agnostic view of a version's raw source — trivial
 * passthrough, kept as its own file so cli/render and any future UI
 * consume the same shape as every other command (see core/present/show.js
 * for the pattern this mirrors).
 * @param {string} id - commit SHA (full or short)
 * @param {object} raw - the raw source exactly as returned by Store.getRaw()
 * @returns {{id: string, raw: object}}
 */
function buildGetView(id, raw) {
  return { id, raw };
}

module.exports = { buildGetView };
