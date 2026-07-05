#!/usr/bin/env node
// CLI entrypoint. Thin commander wiring only — all real logic lives in
// core/ (feature logic) and cli/commands/ (CLI-specific glue), see README's
// "Directory structure" section for the split rule.
const { Command } = require('commander');
const config = require('../config');
const { cmdInit } = require('./commands/init');
const { cmdNormalize } = require('./commands/normalize');
const { cmdDiff } = require('./commands/diff');
const { cmdAdd } = require('./commands/add');
const { cmdList } = require('./commands/list');
const { cmdShow } = require('./commands/show');
const { cmdGet } = require('./commands/get');
const { cmdRemove } = require('./commands/remove');
const { cmdExtract } = require('./commands/extract');
const { cmdSync } = require('./commands/sync');
const { cmdStatus } = require('./commands/status');
const pkg = require('../../package.json');

const program = new Command();

program
  .name('schema-snapshot')
  .description('Normalize + diff Directus schema snapshots')
  .version(pkg.version)
  .option('--env-file <path>', 'path to .env file (default: SCHEMA_SNAPSHOT_ENV_FILE, then cwd/.env — resolved before this option parses, see config.js)');

program
  .command('init')
  .description('set up a target directory for first use: copies .env, writes .gitignore, initializes the local store — reject if dir already initialized or non-empty')
  .argument('[dir]', 'target directory to initialize', '.')
  .option('--store-dir <dir>', 'store cache dir, created inside <dir>', config.defaultStoreDir)
  .option('--store-type <type>', 'which Store implementation to use (see core/env.js)', config.defaultStoreType)
  .option('--json', 'output the init view as JSON (for UI / programmatic use)')
  .action(cmdInit);

program
  .command('normalize')
  .description('normalize a schema JSON file into a canonical entity tree')
  .argument('<schema.json>', 'path to raw schema export')
  .option('--out-dir <dir>', 'write one file per entity to this directory', config.defaultOutDir)
  .option('--dry-run', 'print normalized tree to stdout, do not write files')
  .option('--schema-type <type>', 'which normalizer to use (see core/normalizers/index.js)', config.defaultSchemaType)
  .option('--subdir-format <format>', 'template for the run subdir name, e.g. "{time}_{name}" (see docs/architecture.md#subdir-format)', config.defaultSubdirFormat)
  .option('--file-format <format>', 'which Parser to use for the input file (see core/parsers/index.js)', config.defaultFileFormat)
  .action(cmdNormalize);

program
  .command('diff')
  .description('diff two schemas — file paths, event ids, or content hashes (auto-detected)')
  .argument('<a>', 'older schema: file path, event id ("e3"), or content hash from `list`')
  .argument('<b>', 'newer schema: file path, event id ("e3"), or content hash from `list`')
  .option('--schema-type <type>', 'which normalizer to use (see core/normalizers/index.js)', config.defaultSchemaType)
  .option('--store-dir <dir>', 'where the version store (git repo) lives', config.defaultStoreDir)
  .option('--store-type <type>', 'which Store implementation to use (see core/env.js)', config.defaultStoreType)
  .option('--file-format <format>', 'which Parser to use for file args (see core/parsers/index.js)', config.defaultFileFormat)
  .option('--snapshots-dir <dir>', 'host-repo-tracked event log + source dir, used to resolve event id/hash args (see docs/proposal-schema-snapshot-sync.md)', config.defaultSnapshotsDir)
  .option('--cache-ref', 'treat non-file args as raw GitStore commit shas instead of event id/hash (debug/special-case)')
  .option('--json', 'output the diff view as JSON (for UI / programmatic use)')
  .action(cmdDiff);

program
  .command('add')
  .description('normalize a schema JSON file and commit it as a new version (git-backed)')
  .argument('<schema.json>', 'path to raw schema export')
  .option('-m, --message <message>', 'commit message for this version')
  .option('--schema-type <type>', 'which normalizer to use (see core/normalizers/index.js)', config.defaultSchemaType)
  .option('--store-dir <dir>', 'where the version store (git repo) lives', config.defaultStoreDir)
  .option('--store-type <type>', 'which Store implementation to use (see core/env.js)', config.defaultStoreType)
  .option('--file-format <format>', 'which Parser to use for the input file (see core/parsers/index.js)', config.defaultFileFormat)
  .option('--snapshots-dir <dir>', 'host-repo-tracked event log + source dir, dual-written alongside the git-backed store (see docs/proposal-schema-snapshot-sync.md)', config.defaultSnapshotsDir)
  .option('--json', 'output the add view as JSON (for UI / programmatic use)')
  .action(cmdAdd);

program
  .command('list')
  .description('list all committed versions, newest first')
  .option('--store-dir <dir>', 'where the version store (git repo) lives', config.defaultStoreDir)
  .option('--store-type <type>', 'which Store implementation to use (see core/env.js)', config.defaultStoreType)
  .option('--snapshots-dir <dir>', 'host-repo-tracked event log + source dir (see docs/proposal-schema-snapshot-sync.md)', config.defaultSnapshotsDir)
  .option('--show-cache-ref', 'also show the GitStore commit sha — disposable, regenerated by `sync`; needed for show/get/diff/remove --latest')
  .option('--json', 'output raw JSON array (for UI / programmatic use)')
  .action(cmdList);

program
  .command('show')
  .description('show all entities in a committed version')
  .argument('<id>', 'event id ("e3") or content hash from `list`')
  .option('--store-dir <dir>', 'where the version store (git repo) lives', config.defaultStoreDir)
  .option('--store-type <type>', 'which Store implementation to use (see core/env.js)', config.defaultStoreType)
  .option('--snapshots-dir <dir>', 'host-repo-tracked event log + source dir, used to resolve id (see docs/proposal-schema-snapshot-sync.md)', config.defaultSnapshotsDir)
  .option('--cache-ref', 'treat <id> as a raw GitStore commit sha instead of event id/hash (debug/special-case)')
  .option('--json', 'output full EntityTree as JSON (for UI / programmatic use)')
  .action(cmdShow);

program
  .command('get')
  .description('retrieve the original source exactly as committed by `add` — no reconstruction, no merge')
  .argument('<id>', 'event id ("e3") or content hash from `list`')
  .option('--store-dir <dir>', 'where the version store (git repo) lives', config.defaultStoreDir)
  .option('--store-type <type>', 'which Store implementation to use (see core/env.js)', config.defaultStoreType)
  .option('--snapshots-dir <dir>', 'host-repo-tracked event log + source dir, used to resolve id (see docs/proposal-schema-snapshot-sync.md)', config.defaultSnapshotsDir)
  .option('--cache-ref', 'treat <id> as a raw GitStore commit sha instead of event id/hash (debug/special-case)')
  .option('--out-file <path>', 'write the raw source to this file instead of stdout')
  .option('--json', 'output {id, raw} as JSON (for UI / programmatic use)')
  .action(cmdGet);

program
  .command('remove')
  .description('remove a version — safe, non-destructive (nothing is deleted)')
  .option('--latest', 'revert the most recently committed version in the local GitStore cache')
  .option('--hash <hash>', 'append a tombstone event for the latest active add matching this content hash (schema-snapshots/meta.json)')
  .option('--id <eventId>', 'append a tombstone event for this exact add event id — disambiguates a hash added multiple times')
  .option('--yes', 'skip the confirmation prompt (--latest only)')
  .option('--schema-type <type>', 'which normalizer to use for preview diffs (see core/normalizers/index.js)', config.defaultSchemaType)
  .option('--store-dir <dir>', 'where the version store (git repo) lives', config.defaultStoreDir)
  .option('--store-type <type>', 'which Store implementation to use (see core/env.js)', config.defaultStoreType)
  .option('--file-format <format>', 'which Parser to use for preview diffs (see core/parsers/index.js)', config.defaultFileFormat)
  .option('--snapshots-dir <dir>', 'host-repo-tracked event log + source dir (see docs/proposal-schema-snapshot-sync.md)', config.defaultSnapshotsDir)
  .option('--json', 'output the remove view as JSON (for UI / programmatic use)')
  .action(cmdRemove);

program
  .command('sync')
  .description('replay schema-snapshots/meta.json\'s active events into the local GitStore cache — idempotent')
  .option('--schema-type <type>', 'which normalizer to use (see core/normalizers/index.js)', config.defaultSchemaType)
  .option('--store-dir <dir>', 'where the version store (git repo) lives', config.defaultStoreDir)
  .option('--store-type <type>', 'which Store implementation to use (see core/env.js)', config.defaultStoreType)
  .option('--snapshots-dir <dir>', 'host-repo-tracked event log + source dir (see docs/proposal-schema-snapshot-sync.md)', config.defaultSnapshotsDir)
  .option('--json', 'output {syncedCount, syncedHash} as JSON (for UI / programmatic use)')
  .action(cmdSync);

program
  .command('status')
  .description('read-only: compare schema-snapshots/meta.json\'s current hash against the last-synced hash')
  .option('--store-dir <dir>', 'where the version store (git repo) lives', config.defaultStoreDir)
  .option('--snapshots-dir <dir>', 'host-repo-tracked event log + source dir (see docs/proposal-schema-snapshot-sync.md)', config.defaultSnapshotsDir)
  .option('--json', 'output {inSync, currentHash, syncedHash} as JSON (for UI / programmatic use)')
  .action(cmdStatus);

program
  .command('extract')
  .description('extract a partial snapshot of only added or only removed entities between two schemas')
  .argument('<old>', 'older schema: file path, event id ("e3"), or content hash from `list`')
  .argument('<new>', 'newer schema: file path, event id ("e3"), or content hash from `list`')
  .requiredOption('--mode <mode>', 'which part of the diff to extract: "added", "removed", or "modified"')
  .option('--no-dry-run', 'write the extracted entities to disk (default: print tree to stdout, write nothing)')
  .option('--out-dir <dir>', 'write one file per extracted entity to a fresh subdir of this directory', config.defaultOutDir)
  .option('--subdir-format <format>', 'template for the run subdir name, e.g. "{time}_{name}" (see docs/architecture.md#subdir-format)', config.defaultSubdirFormat)
  .option('--schema-type <type>', 'which normalizer to use (see core/normalizers/index.js)', config.defaultSchemaType)
  .option('--store-dir <dir>', 'where the version store (git repo) lives', config.defaultStoreDir)
  .option('--store-type <type>', 'which Store implementation to use (see core/env.js)', config.defaultStoreType)
  .option('--file-format <format>', 'which Parser to use for file args (see core/parsers/index.js)', config.defaultFileFormat)
  .option('--snapshots-dir <dir>', 'host-repo-tracked event log + source dir, used to resolve event id/hash args (see docs/proposal-schema-snapshot-sync.md)', config.defaultSnapshotsDir)
  .option('--cache-ref', 'treat non-file args as raw GitStore commit shas instead of event id/hash (debug/special-case)')
  .option('--snapshot', 'write a single Directus snapshot JSON file instead of individual files')
  .option('--snapshot-file <path>', 'write a single Directus snapshot JSON file to the specified path')
  .option('--json', 'output the extract view as JSON (for UI / programmatic use)')
  .action(cmdExtract);

(async () => {
  try {
    await program.parseAsync();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
})();
