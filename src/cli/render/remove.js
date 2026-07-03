const { printDiffView } = require('./diff');

/**
 * Prints a remove view (from core/present/remove.js) as CLI text.
 * @param {ReturnType<import('../../core/present/remove').buildRemoveView>} view
 */
function printRemoveView(view) {
  console.log(`Removed version ${view.revertedShortId} (reverted via ${view.shortId}).`);
  printDiffView(view.diff);
}

module.exports = { printRemoveView };
