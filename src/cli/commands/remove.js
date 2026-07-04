const readline = require('node:readline/promises');
const { createEnv } = require('../../core/env');
const { removeLatestVersion, removeSnapshotEvent } = require('../../core/operations/remove');
const { getVersionView } = require('../../core/operations/show');
const { diffSchemas } = require('../../core/operations/diff');
const { buildListView } = require('../../core/present/list');
const { printRemoveView } = require('../render/remove');
const { printShowView } = require('../render/show');
const { printDiffView } = require('../render/diff');
const { printListView } = require('../render/list');

/**
 * Prompts on stdin/stdout for y/n/P (preview) confirmation. CLI-specific
 * UX — a UI backend would implement its own confirm flow and skip
 * straight to removeLatestVersion(), which is why this lives here and
 * not in core/. Loops back to the prompt after a preview.
 *
 * Preview shows, in order:
 *   1. the 3 most recent versions (so it's clear which position is being
 *      touched — recentVersions is already sliced by the caller)
 *   2. a labelled "Diff: <previousId> -> <revertedId>" header, then the
 *      diff itself — what removal undoes, not just what the version is.
 * If there's no previous version (revertedId is the only version),
 * there's nothing to diff against, so it falls back to a full show.
 * @param {string} message
 * @param {{revertedId: string, previousId: string | undefined, recentVersions: {id: string, timestamp: string, message: string}[], schemaType: string, store: import('../../core/store/store').Store, parse: (filePath: string) => object}} previewParams
 * @returns {Promise<boolean>}
 */
async function confirm(message, previewParams) {
  const { revertedId, previousId, recentVersions, schemaType, store, parse } = previewParams;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const answer = (await rl.question(`${message} [y/n/P] `)).trim();
      if (/^y(es)?$/i.test(answer)) return true;
      if (/^p(review)?$/i.test(answer)) {
        printListView(buildListView(recentVersions));
        console.log('');
        if (previousId) {
          console.log(`Diff: ${previousId.slice(0, 7)} -> ${revertedId.slice(0, 7)}`);
          const view = await diffSchemas({ a: previousId, b: revertedId, schemaType, store, parse });
          printDiffView(view);
        } else {
          const view = await getVersionView({ id: revertedId, store });
          printShowView(view);
        }
        continue;
      }
      return false;
    }
  } finally {
    rl.close();
  }
}

/**
 * commander action handler for `remove --latest`.
 * Safe removal only: reverts the most recent commit (a new commit
 * undoing the last one — see core/operations/remove.js), nothing is
 * deleted or rewritten. Prompts for confirmation unless --yes.
 *
 * Step 6 (`remove <id> --force`, destructive git reset --hard) is
 * intentionally not built — only add it if --latest proves insufficient
 * in practice.
 *
 * `--hash <hash>` / `--id <eventId>` are a separate, sync-able removal
 * path: append a tombstone event to schema-snapshots/meta.json (see
 * core/operations/remove.js's removeSnapshotEvent, proposal gap 3.4/3.6).
 * Mutually exclusive with `--latest` — different mechanisms, but
 * `--latest` also tombstones the reverted version's meta.json event when
 * one exists (see removeLatestVersion), so the two stores can't drift out
 * of sync with each other.
 * @param {{latest?: boolean, hash?: string, id?: string, yes?: boolean, schemaType: string, storeDir: string, storeType: string, fileFormat: string, snapshotsDir: string, json?: boolean}} options
 */
async function cmdRemove(options) {
  if (options.latest && (options.hash || options.id)) {
    throw new Error('--latest is mutually exclusive with --hash/--id');
  }

  if (options.hash || options.id) {
    const event = removeSnapshotEvent({ snapshotsDir: options.snapshotsDir, hash: options.hash, eventId: options.id });
    if (options.json) {
      process.stdout.write(JSON.stringify(event, null, 2) + '\n');
      return;
    }
    console.log(`Removed event ${event.removes} (tombstone ${event.id})`);
    return;
  }

  if (!options.latest) {
    throw new Error('Specify --latest, --hash <hash>, or --id <eventId>');
  }

  const { store, parse } = createEnv({ storeDir: options.storeDir, storeType: options.storeType, fileFormat: options.fileFormat });

  if (!options.yes) {
    const versions = await store.list();
    if (versions.length === 0) {
      throw new Error('No versions to remove');
    }
    const revertedId = versions[0].id;
    const previousId = versions[1] && versions[1].id;

    const ok = await confirm('Revert the most recent version?', {
      revertedId,
      previousId,
      recentVersions: versions.slice(0, 3),
      schemaType: options.schemaType,
      store,
      parse,
    });
    if (!ok) {
      console.log('Aborted.');
      return;
    }
  }

  const view = await removeLatestVersion({ store, snapshotsDir: options.snapshotsDir });

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    return;
  }
  printRemoveView(view);
}

module.exports = { cmdRemove };
