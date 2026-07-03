/**
 * Prints a get view (from core/present/get.js) as CLI text — the raw
 * source, pretty-printed JSON, nothing computed or reformatted.
 * @param {ReturnType<import('../../core/present/get').buildGetView>} view
 */
function printGetView(view) {
  console.log(JSON.stringify(view.raw, null, 2));
}

module.exports = { printGetView };
