function printGroups(label, groups) {
  if (groups.length === 0) return;
  console.log(`\n  [${label}]`);
  let first = true;
  groups.forEach(({ collection, fields }, i) => {
    if (!first) console.log('');
    first = false;
    console.log(`    ${i + 1}. ${collection}`);

    const labels = fields.map((f, j) => `${j + 1}. ${f.field}`);
    const width = Math.max(...labels.map((l) => l.length));
    fields.forEach((f, j) => {
      const detail = f.detail.trimStart();
      console.log(`      ${labels[j].padEnd(width)}${detail ? `  ${detail}` : ''}`);
    });
  });
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
    view.collections.forEach((collection, i) => {
      console.log(`    ${i + 1}. ${collection}`);
    });
  }

  printGroups('field', view.fieldGroups);
  printGroups('field / system', view.systemFieldGroups);
  printGroups('relation', view.relationGroups);
  printGroups('relation / system', view.systemRelationGroups);
}

module.exports = { printShowView };
