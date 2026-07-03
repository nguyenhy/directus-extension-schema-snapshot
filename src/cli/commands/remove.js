const readline = require('node:readline/promises');
const { createEnv } = require('../../core/env');
const { removeLatestVersion } = require('../../core/operations/remove');
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
 * @param {{latest?: boolean, yes?: boolean, schemaType: string, storeDir: string, storeType: string, fileFormat: string, json?: boolean}} options
 */
async function cmdRemove(options) {
  if (!options.latest) {
    throw new Error('Specify --latest (the only supported removal mode today)');
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

  const view = await removeLatestVersion({ store });

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
    return;
  }
  printRemoveView(view);
}

module.exports = { cmdRemove };
