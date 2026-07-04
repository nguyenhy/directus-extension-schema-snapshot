/**
 * Prints a list view (from core/present/list.js) as CLI text — one row
 * per schema-snapshots/meta.json event: event id, action (`add <hash>` or
 * `undo <eventId>`), commit timestamp, event timestamp (see
 * buildListView's doc comment for why both are shown, not just one).
 *
 * `cache-ref` (the GitStore commit sha) is hidden by default — it's a
 * disposable id, regenerated every `sync`, so leading with it invites
 * confusion with the durable `event` identity from
 * schema-snapshots/meta.json. Pass `showCacheRef: true` (CLI: `--show-
 * cache-ref`) to include it, e.g. when you need a value for `show`/`get`/
 * `diff`/`remove --latest`, which all take a cache-ref.
 *
 * No trailing legend is printed — event/hash/cache-ref meaning,
 * `--show-cache-ref`, and `remove --hash`/`--id` usage are all documented
 * in docs/cli-commands.md ("Which id goes where" table and the `list`/
 * `remove` sections); repeating that prose after every table row just
 * adds noise to the common case.
 * @param {ReturnType<import('../../core/present/list').buildListView>} view
 * @param {{showCacheRef?: boolean}} [opts]
 */
function printListView(view, { showCacheRef = false } = {}) {
  if (view.count === 0) {
    console.log('No versions yet. Run `add <schema.json>` to commit a snapshot.');
    return;
  }

  const actionWidth = Math.max(6, ...view.versions.map((v) => v.action.length));
  console.log(`${view.count} version${view.count === 1 ? '' : 's'} (newest first):\n`);
  if (showCacheRef) {
    console.log(`  cache-ref  event  ${'action'.padEnd(actionWidth)}  commit-timestamp     event-timestamp`);
    for (const v of view.versions) {
      console.log(`  ${v.shortId}    ${v.event.padEnd(5)}  ${v.action.padEnd(actionWidth)}  ${v.commitTimestamp}  ${v.eventTimestamp}`);
    }
  } else {
    console.log(`  event  ${'action'.padEnd(actionWidth)}  commit-timestamp     event-timestamp`);
    for (const v of view.versions) {
      console.log(`  ${v.event.padEnd(5)}  ${v.action.padEnd(actionWidth)}  ${v.commitTimestamp}  ${v.eventTimestamp}`);
    }
  }
}

module.exports = { printListView };
