/**
 * Prints an extract view (from core/present/extract.js) as CLI text.
 * @param {ReturnType<import('../../core/present/extract').buildExtractView>} view
 */
function printExtractView(view) {
  const prefix = view.mode === 'added' ? '+' : view.mode === 'modified' ? '~' : '-';
  for (const key of view.keys) {
    console.log(`${prefix} ${key}`);
  }
  console.log(`\n${view.count} ${view.mode} -> ${view.dir}`);
}

module.exports = { printExtractView };
