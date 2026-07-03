function printGroups(label, groups) {
  if (groups.length === 0) return;
  console.log(`\n  [${label}]`);
  let first = true;
  for (const { collection, fields } of groups) {
    if (!first) console.log('');
    first = false;
    console.log(`    ${collection}`);
    for (const { field, detail } of fields) {
      console.log(`      ${field}${detail}`);
    }
  }
}

/**
 * Prints a show view (from core/present/show.js) as CLI text.
 * @param {ReturnType<import('../../core/present/show').buildShowView>} view
 */
function printShowView(view) {
  const summaryStr = view.summary
    .map(({ kind, count }) => `${count} ${kind}${count === 1 ? '' : 's'}`)
    .join(', ');
  console.log(`Version ${view.id.slice(0, 7)} — ${view.entityCount} entities (${summaryStr}):`);

  if (view.collections.length) {
    console.log('\n  [collection]');
    for (const collection of view.collections) {
      console.log(`    ${collection}`);
    }
  }

  printGroups('field', view.fieldGroups);
  printGroups('field / system', view.systemFieldGroups);
  printGroups('relation', view.relationGroups);
  printGroups('relation / system', view.systemRelationGroups);
}

module.exports = { printShowView };
