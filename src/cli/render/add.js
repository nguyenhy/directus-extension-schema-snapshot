const { printDiffView } = require('./diff');

/**
 * Prints an add view (from core/present/add.js) as CLI text.
 * @param {ReturnType<import('../../core/present/add').buildAddView>} view
 */
function printAddView(view) {
  console.log(`Version ${view.shortId} added${view.message !== '(no message)' ? ` (${view.message})` : ''}.`);
  printDiffView(view.diff);
}

module.exports = { printAddView };
