const { GitStore } = require('../../core/store/git');

/**
 * commander action handler for `list`.
 *
 * Human output (default): table of short-id / timestamp / message, newest first,
 * with a total count and navigation hint.
 *
 * Machine output (--json): JSON array of {id, timestamp, message} to stdout —
 * UI integrations should use this flag and call store.list() directly via the
 * core API instead of screen-scraping console output.
 *
 * @param {{storeDir: string, json?: boolean}} options
 */
async function cmdList(options) {
  const store = new GitStore(options.storeDir);
  const versions = await store.list();

  if (options.json) {
    process.stdout.write(JSON.stringify(versions, null, 2) + '\n');
    return;
  }

  if (versions.length === 0) {
    console.log('No versions yet. Run `add <schema.json>` to commit a snapshot.');
    return;
  }

  console.log(`${versions.length} version${versions.length === 1 ? '' : 's'} (newest first):\n`);
  for (const v of versions) {
    const ts = new Date(v.timestamp).toISOString().replace('T', ' ').slice(0, 19);
    console.log(`  ${v.id.slice(0, 7)}  ${ts}  ${v.message}`);
  }
  console.log('\nUse `show <id>` to inspect a version, `diff <id_a> <id_b>` to compare two.');
}

module.exports = { cmdList };
