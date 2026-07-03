/**
 * Prints a normalize view (from core/present/normalize.js) as CLI text.
 * @param {ReturnType<import('../../core/present/normalize').buildNormalizeView>} view
 */
function printNormalizeView(view) {
  console.log(`Normalized ${view.entityCount} entities -> ${view.dir}`);
}

module.exports = { printNormalizeView };
