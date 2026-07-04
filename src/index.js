// Package entry point — curated public API surface. Anything not
// re-exported here is internal and may move without a major bump (see
// README's "Versioning" section).
const { createEnv } = require('./core/env');
const { normalizeSchema, buildMeta } = require('./core/operations/normalize');
const { diffSchemas } = require('./core/operations/diff');
const { addVersion } = require('./core/operations/add');
const { listVersionsView } = require('./core/operations/list');
const { getVersionView } = require('./core/operations/show');
const { getRawSourceView } = require('./core/operations/get');
const { extractSchemas, buildExtractMeta, mergeIntoOld, verifyMerge } = require('./core/operations/extract');
const { removeLatestVersion, removeSnapshotEvent } = require('./core/operations/remove');
const { statusView } = require('./core/operations/status');
const { syncSnapshots, readSyncState, writeSyncState } = require('./core/operations/sync');
const { entityKey } = require('./core/directus/normalize');
const errors = require('./core/errors');

module.exports = {
  createEnv,
  normalizeSchema,
  buildMeta,
  diffSchemas,
  addVersion,
  listVersionsView,
  getVersionView,
  getRawSourceView,
  extractSchemas,
  buildExtractMeta,
  mergeIntoOld,
  verifyMerge,
  removeLatestVersion,
  removeSnapshotEvent,
  statusView,
  syncSnapshots,
  readSyncState,
  writeSyncState,
  entityKey,
  errors,
};
