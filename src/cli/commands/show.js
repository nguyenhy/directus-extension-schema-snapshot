const { getVersionView } = require('../../core/operations/show');
const { printShowView } = require('../render/show');

/**
 * commander action handler for `show <id>`.
 * Thin CLI glue: delegates to core/operations/show.js (reusable by a UI
 * backend too), then chooses whether to print or JSON-dump the view.
 *
 * Human output:
 *   - Collections: flat list
 *   - Fields: grouped by collection, system fields (id/dates/user_*) in separate block
 *   - Relations: grouped by collection, system relations in separate block
 * --json: the same derived view as JSON (for UI / programmatic use).
 *
 * @param {string} id - commit SHA (full or short prefix from `list`)
 * @param {{storeDir: string, json?: boolean}} options
 */
async function cmdShow(id, options) {
  const view = await getVersionView({ id, storeDir: options.storeDir });

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    return;
  }

  printShowView(view);
}

module.exports = { cmdShow };
