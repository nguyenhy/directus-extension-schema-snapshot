const path = require('path');
const { createEnv } = require('../../core/env');
const { diffSchemas } = require('../../core/operations/diff');
const { resolveArgOrFile } = require('../../core/snapshotSync/resolve');
const { printDiffView } = require('../render/diff');
const { printExtractView, printVerification } = require('../render/extract');

/**
 * commander action handler for `diff <a> <b>`.
 * Thin CLI glue: delegates to core/operations/diff.js (reusable by a UI
 * backend too — same file-vs-version auto-detection there), then chooses
 * whether to print or JSON-dump the view.
 *
 * Three output modes, mutually exclusive:
 *   - default: full added/removed/modified diff (unchanged from before).
 *   - `--show <mode>`: view-only filter to one category, never writes.
 *   - `--snapshot <mode> [outFile]`: writes a full denormalized snapshot
 *     for one category — absorbs what used to be the separate `extract`
 *     command (`extract <a> <b> --mode X --snapshot --no-dry-run` is now
 *     `diff <a> <b> --snapshot X`). Writes by default; pass `--dry-run`
 *     to preview instead. Second value (optional) is an explicit output
 *     file path (was `--snapshot-file`); omitted, writes to a fresh
 *     subdir of `--out-dir`.
 *
 * Non-file args are event ids or content hashes by default, resolved
 * through schema-snapshots/meta.json (see core/snapshotSync/resolve.js).
 * Pass `--cache-ref` to treat non-file args as raw GitStore commit shas
 * instead — applies to both `a` and `b` uniformly.
 * @param {string} a
 * @param {string} b
 * @param {{schemaType: string, storeDir: string, storeType: string, fileFormat: string, snapshotsDir: string, cacheRef?: boolean, json?: boolean, show?: string, snapshot?: string[], outDir: string, subdirFormat: string, dryRun?: boolean}} options
 */
async function cmdDiff(a, b, options) {
  const { store, parse } = createEnv({ storeDir: options.storeDir, storeType: options.storeType, fileFormat: options.fileFormat });

  // Fetch store.list() once and share it — resolveArgOrFile/resolveRef
  // would otherwise each call it independently, doubling the git-log read
  // for a two-arg command like this one.
  const versions = options.cacheRef ? undefined : await store.list();
  const resolveOpts = { snapshotsDir: options.snapshotsDir, store, cacheRef: options.cacheRef, versions };
  const [resolvedA, resolvedB] = await Promise.all([resolveArgOrFile(a, resolveOpts), resolveArgOrFile(b, resolveOpts)]);

  if (options.show && options.snapshot) {
    throw new Error('--show and --snapshot are mutually exclusive');
  }

  let snapshotMode, snapshotFile;
  if (options.snapshot) {
    if (options.snapshot.length > 2) {
      throw new Error(`--snapshot takes mode and optional output file, got ${options.snapshot.length} args`);
    }
    [snapshotMode, snapshotFile] = options.snapshot;
  }

  const result = await diffSchemas({
    a: resolvedA, b: resolvedB, schemaType: options.schemaType, store, parse,
    show: options.show, snapshotMode, snapshotFile,
    outDir: options.outDir, subdirFormat: options.subdirFormat,
    dryRun: !!options.dryRun,
    refA: a, refB: b,
  });

  if (!options.show && !snapshotMode) {
    if (options.json) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      return;
    }
    printDiffView(result);
    return;
  }

  if (!snapshotMode) {
    // --show: view-only category filter, never writes.
    if (options.json) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      return;
    }
    const prefix = result.mode === 'added' ? '+' : result.mode === 'modified' ? '~' : '-';
    for (const key of result.keys) console.log(`${prefix} ${key}`);
    console.log(`\n${result.count} ${result.mode}`);
    return;
  }

  // --snapshot <mode> [outFile]
  if (result.dryRun) {
    if (options.json) {
      const output = { mode: result.mode, keys: result.keys, dir: result.dir, tree: result.tree, snapshot: result.snapshot, meta: result.meta, verification: result.verification };
      process.stdout.write(JSON.stringify(output, null, 2) + '\n');
      return;
    }
    console.log(JSON.stringify(result.snapshot, null, 2));
    const target = result.file || path.join(result.dir, 'snapshot.json');
    console.log(`\n${result.keys.length} ${result.mode} snapshot -> ${target} (dry run, nothing written; drop --dry-run to write)`);
    printVerification(result.verification);
    return;
  }

  const view = { ...result.view, verification: result.verification };
  if (options.json) {
    process.stdout.write(JSON.stringify(view, null, 2) + '\n');
  } else {
    printExtractView(view);
  }

  if (!result.verification.ok) {
    throw new Error(`merge verification failed: ${JSON.stringify(result.verification)}`);
  }
}

module.exports = { cmdDiff };
