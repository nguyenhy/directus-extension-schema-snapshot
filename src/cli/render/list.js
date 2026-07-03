/**
 * Prints a list view (from core/present/list.js) as CLI text.
 * @param {ReturnType<import('../../core/present/list').buildListView>} view
 */
function printListView(view) {
  if (view.count === 0) {
    console.log('No versions yet. Run `add <schema.json>` to commit a snapshot.');
    return;
  }

  console.log(`${view.count} version${view.count === 1 ? '' : 's'} (newest first):\n`);
  for (const v of view.versions) {
    console.log(`  ${v.shortId}  ${v.timestamp}  ${v.message}`);
  }
  console.log('\nUse `show <id>` to inspect a version, `diff <id_a> <id_b>` to compare two.');
}

module.exports = { printListView };
