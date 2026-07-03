const crypto = require('crypto');

/**
 * Recursively sorts object keys so contentHash() is independent of key
 * insertion order — required for the hash to be deterministic across
 * devices (see docs/proposal-schema-snapshot-sync.md gap 3.1).
 * @param {*} value - any JSON-compatible value
 * @returns {*} same shape, object keys sorted at every level
 */
function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeysDeep(value[key]);
    return out;
  }
  return value;
}

/**
 * Deterministic sha256 hash of a JSON-serializable value. Used as the
 * public, cross-device identity for a schema-snapshots source file — git
 * commit hashes vary by author/timestamp/parent across clones, this does
 * not (see docs/proposal-schema-snapshot-sync.md §2, gap 3.1).
 * @param {*} value - any JSON-compatible value
 * @returns {string} lowercase hex sha256 digest
 */
function contentHash(value) {
  const json = JSON.stringify(sortKeysDeep(value));
  return crypto.createHash('sha256').update(json).digest('hex');
}

module.exports = { contentHash, sortKeysDeep };
