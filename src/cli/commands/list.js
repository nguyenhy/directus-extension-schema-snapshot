const { listVersionsView } = require('../../core/operations/list');
const { printListView } = require('../render/list');

/**
 * commander action handler for `list`.
 * Thin CLI glue: delegates to core/operations/list.js (reusable by a UI
 * backend too), then chooses whether to print or JSON-dump the view.
 *
 * Human output (default): table of short-id / timestamp / message, newest first,
 * with a total count and navigation hint.
 *
 * Machine output (--json): the same derived view as JSON — UI integrations
 * should use this flag instead of screen-scraping console output.
 *
 * @param {{storeDir: string, json?: boolean}} options
 */
async function cmdList(options) {
  const view = await listVersionsView({ storeDir: options.storeDir });

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    return;
  }

  printListView(view);
}

module.exports = { cmdList };
