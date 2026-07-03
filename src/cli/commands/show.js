const { GitStore } = require('../../core/store/git');
const { buildShowView } = require('../../core/present/show');
const { printShowView } = require('../render/show');

/**
 * commander action handler for `show <id>`.
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
  const store = new GitStore(options.storeDir);
  const tree = await store.get(id);
  const view = buildShowView(id, tree);

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    return;
  }

  printShowView(view);
}

module.exports = { cmdShow };
