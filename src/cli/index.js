#!/usr/bin/env node
// CLI entrypoint. Thin commander wiring only — all real logic lives in
// core/ (feature logic) and cli/commands/ (CLI-specific glue), see README's
// "Directory structure" section for the split rule.
const { Command } = require('commander');
const config = require('../config');
const { cmdNormalize } = require('./commands/normalize');
const { cmdDiff } = require('./commands/diff');
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
  .action(cmdNormalize);

program
  .command('diff')
  .description('structural diff between two schema JSON files (added/modified/removed)')
  .argument('<schema_old.json>', 'path to older schema export')
  .argument('<schema_new.json>', 'path to newer schema export')
  .option('--schema-type <type>', 'which normalizer to use (see core/normalizers/index.js)', config.defaultSchemaType)
  .action(cmdDiff);

try {
  program.parse();
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
