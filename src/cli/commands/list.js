const { GitStore } = require('../../core/store/git');
const { buildListView } = require('../../core/present/list');
const { printListView } = require('../render/list');

/**
 * commander action handler for `list`.
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
  const store = new GitStore(options.storeDir);
  const versions = await store.list();
  const view = buildListView(versions);

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    return;
  }

  printListView(view);
}

module.exports = { cmdList };
