const path = require('path');
const { createEnv } = require('../../core/env');
const { extractSchemas } = require('../../core/operations/extract');
const { resolveArgOrFile } = require('../../core/snapshotSync/resolve');
const { printExtractView, printVerification } = require('../render/extract');

/**
 * commander action handler for `extract <old> <new>`.
 * Thin CLI glue: delegates to core/operations/extract.js (reusable by a UI
 * backend too — same file-vs-version auto-detection as `diff`), then
 * chooses whether to print or JSON-dump the view.
 *
 * Unlike `diff`, mixing is restricted: `<old>` as a file with `<new>` as an
 * event id/hash is rejected (extractSchemas throws) — only file+file,
 * id/hash+file, and id/hash+id/hash are supported. See docs/cli-commands.md.
 *
 * Non-file args are event ids or content hashes by default, resolved
 * through schema-snapshots/meta.json (see core/snapshotSync/resolve.js,
 * same treatment as `diff`). Pass `--cache-ref` to treat non-file args as
 * raw GitStore commit shas instead.
 *
 * On a real (non-dry-run) --snapshot/--snapshot-file write, a failed merge
 * verification throws (see below) so the file was still written to disk but
 * the CLI reports failure — this repo's "non-destructive" guarantee doesn't
 * extend to "never writes a wrong file," only to never destroying history.
 * @param {string} oldSchema
 * @param {string} newSchema
 * @param {{mode: 'added'|'removed'|'modified', schemaType: string, storeDir: string, storeType: string, fileFormat: string, snapshotsDir: string, cacheRef?: boolean, outDir: string, subdirFormat: string, dryRun?: boolean, json?: boolean, snapshot?: boolean, snapshotFile?: string}} options
 */
async function cmdExtract(oldSchema, newSchema, options) {
  const { store, parse } = createEnv({ storeDir: options.storeDir, storeType: options.storeType, fileFormat: options.fileFormat });

  // Fetch store.list() once and share it — see cmdDiff's identical note.
  const versions = options.cacheRef ? undefined : await store.list();
  const resolveOpts = { snapshotsDir: options.snapshotsDir, store, cacheRef: options.cacheRef, versions };
  const [resolvedOld, resolvedNew] = await Promise.all([
    resolveArgOrFile(oldSchema, resolveOpts),
    resolveArgOrFile(newSchema, resolveOpts),
  ]);

  const result = await extractSchemas({
    oldSchema: resolvedOld,
    newSchema: resolvedNew,
    mode: options.mode,
    schemaType: options.schemaType,
    outDir: options.outDir,
    subdirFormat: options.subdirFormat,
    dryRun: options.dryRun,
    store,
    parse,
    snapshot: options.snapshot,
    snapshotFile: options.snapshotFile,
  });

  if (result.dryRun) {
    if (options.json) {
      const output = { mode: result.mode, keys: result.keys, dir: result.dir, tree: result.tree };
      if (result.isSnapshot) {
        output.snapshot = result.snapshot;
        output.meta = result.meta;
        output.verification = result.verification;
      }
      process.stdout.write(JSON.stringify(output, null, 2) + '\n');
      return;
    }
    if (result.isSnapshot) {
      console.log(JSON.stringify(result.snapshot, null, 2));
      const target = options.snapshotFile || path.join(result.dir, 'snapshot.json');
      console.log(`\n${result.keys.length} ${result.mode} snapshot -> ${target} (dry run, nothing written; pass --no-dry-run to write)`);
      // Dry-run never sets exitCode on a failed verification — nothing was
      // written yet, so there's nothing on disk to fail against. The
      // preview still prints ✗ so the user can see it before committing.
      printVerification(result.verification);
    } else {
      console.log(JSON.stringify(result.tree, null, 2));
      console.log(`\n${result.keys.length} ${result.mode} -> ${result.dir} (dry run, nothing written; pass --no-dry-run to write)`);
    }
    return;
  }

  const view = result.isSnapshot ? { ...result.view, verification: result.verification } : result.view;

  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
  } else {
    printExtractView(view);
  }

  // Thrown, not console.error+exitCode, so this goes through cli/index.js's
  // central catch like every other user-facing failure in this codebase —
  // the file is already written at this point; this only affects reporting.
  if (result.isSnapshot && !result.verification.ok) {
    throw new Error(`merge verification failed: ${JSON.stringify(result.verification)}`);
  }
}

module.exports = { cmdExtract };
