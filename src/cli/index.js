#!/usr/bin/env node
// CLI entrypoint. Thin commander wiring only — all real logic lives in
// core/ (feature logic) and cli/commands/ (CLI-specific glue), see README's
// "Directory structure" section for the split rule.
const { Command } = require('commander');
const config = require('../config');
const { cmdNormalize } = require('./commands/normalize');
const { cmdDiff } = require('./commands/diff');
const { cmdAdd } = require('./commands/add');
const { cmdList } = require('./commands/list');
const { cmdShow } = require('./commands/show');
const { cmdRemove } = require('./commands/remove');
const { cmdExtract } = require('./commands/extract');
const pkg = require('../../package.json');

const program = new Command();

program
  .name('schema-snapshot')
  .description('Normalize + diff Directus schema snapshots')
  .version(pkg.version);

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
  .description('diff two schemas — file paths or committed version IDs (auto-detected)')
  .argument('<a>', 'older schema: file path or commit SHA from `list`')
  .argument('<b>', 'newer schema: file path or commit SHA from `list`')
  .option('--schema-type <type>', 'which normalizer to use (see core/normalizers/index.js)', config.defaultSchemaType)
  .option('--store-dir <dir>', 'where the version store (git repo) lives', config.defaultStoreDir)
  .option('--store-type <type>', 'which Store implementation to use (see core/env.js)', config.defaultStoreType)
  .option('--file-format <format>', 'which Parser to use for file args (see core/parsers/index.js)', config.defaultFileFormat)
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
  .option('--json', 'output the add view as JSON (for UI / programmatic use)')
  .action(cmdAdd);

program
  .command('list')
  .description('list all committed versions, newest first')
  .option('--store-dir <dir>', 'where the version store (git repo) lives', config.defaultStoreDir)
  .option('--store-type <type>', 'which Store implementation to use (see core/env.js)', config.defaultStoreType)
  .option('--json', 'output raw JSON array (for UI / programmatic use)')
  .action(cmdList);

program
  .command('show')
  .description('show all entities in a committed version')
  .argument('<id>', 'commit SHA (full or short prefix from `list`)')
  .option('--store-dir <dir>', 'where the version store (git repo) lives', config.defaultStoreDir)
  .option('--store-type <type>', 'which Store implementation to use (see core/env.js)', config.defaultStoreType)
  .option('--json', 'output full EntityTree as JSON (for UI / programmatic use)')
  .action(cmdShow);

program
  .command('remove')
  .description('remove a version — safe, non-destructive (creates a revert commit, nothing is deleted)')
  .option('--latest', 'remove the most recently committed version (the only supported mode today)')
  .option('--yes', 'skip the confirmation prompt')
  .option('--schema-type <type>', 'which normalizer to use for preview diffs (see core/normalizers/index.js)', config.defaultSchemaType)
  .option('--store-dir <dir>', 'where the version store (git repo) lives', config.defaultStoreDir)
  .option('--store-type <type>', 'which Store implementation to use (see core/env.js)', config.defaultStoreType)
  .option('--file-format <format>', 'which Parser to use for preview diffs (see core/parsers/index.js)', config.defaultFileFormat)
  .option('--json', 'output the remove view as JSON (for UI / programmatic use)')
  .action(cmdRemove);

program
  .command('extract')
  .description('extract a partial snapshot of only added or only removed entities between two schemas')
  .argument('<old>', 'older schema: file path or commit SHA from `list`')
  .argument('<new>', 'newer schema: file path or commit SHA from `list`')
  .requiredOption('--mode <mode>', 'which part of the diff to extract: "added", "removed", or "modified"')
  .option('--no-dry-run', 'write the extracted entities to disk (default: print tree to stdout, write nothing)')
  .option('--out-dir <dir>', 'write one file per extracted entity to a fresh subdir of this directory', config.defaultOutDir)
  .option('--subdir-format <format>', 'template for the run subdir name, e.g. "{time}_{name}" (see docs/architecture.md#subdir-format)', config.defaultSubdirFormat)
  .option('--schema-type <type>', 'which normalizer to use (see core/normalizers/index.js)', config.defaultSchemaType)
  .option('--store-dir <dir>', 'where the version store (git repo) lives', config.defaultStoreDir)
  .option('--store-type <type>', 'which Store implementation to use (see core/env.js)', config.defaultStoreType)
  .option('--file-format <format>', 'which Parser to use for file args (see core/parsers/index.js)', config.defaultFileFormat)
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
