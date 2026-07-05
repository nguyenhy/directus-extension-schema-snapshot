/**
 * Prints an init view (from core/present/init.js) as CLI text.
 * @param {ReturnType<import('../../core/present/init').buildInitView>} view
 */
function printInitView(view) {
  console.log(`Initialized schema-snapshot in "${view.dir}".`);
  if (view.envCreated) {
    console.log(`  created ${view.envPath}`);
  } else {
    console.log(`  using existing ${view.envPath} (left untouched)`);
  }
  for (const file of view.filesCreated) {
    if (file === view.envPath) continue;
    console.log(`  created ${file}`);
  }
  console.log(`Edit ${view.envPath} if needed, then run \`schema-snapshot add <schema.json>\` to record your first version.`);
}

module.exports = { printInitView };
