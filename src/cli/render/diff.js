/**
 * Prints a diff view (from core/present/diff.js) as CLI +/~/- lines.
 * @param {ReturnType<import('../../core/present/diff').buildDiffView>} view
 */
function printDiffView(view) {
  for (const { label, detail } of view.added) {
    console.log(`+ ${label}${detail}`);
  }
  for (const { label, changes } of view.modified) {
    console.log(`~ ${label}`);
    for (const c of changes) console.log(`    ${c.path}: ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`);
  }
  for (const { label, detail } of view.removed) {
    console.log(`- ${label}${detail}`);
  }
  console.log(`\n${view.summary.addedCount} added, ${view.summary.modifiedCount} modified, ${view.summary.removedCount} removed`);
}

module.exports = { printDiffView };
