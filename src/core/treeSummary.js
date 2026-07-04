/**
 * Buckets an EntityTree's keys by kind into counts + a per-collection
 * fields/relations breakdown. Shared by core/operations/normalize.js's
 * buildMeta() and core/operations/extract.js's buildExtractMeta() — both
 * built the identical run-summary shape, so it lives here once.
 * GOTCHA: parses tree keys assuming core/directus/normalize.js's entityKey()
 * format "kind:collection.name" — silently mis-groups entries if that
 * format ever changes (no error, just wrong/missing entries in the summary).
 * @param {import('./normalizers').EntityTree} tree
 * @returns {{counts: {collections: number, fields: number, relations: number}, collections: Object.<string, {fields: string[], relations: string[]}>}}
 */
function buildTreeSummary(tree) {
  const counts = { collections: 0, fields: 0, relations: 0 };
  /** @type {Object.<string, {fields: string[], relations: string[]}>} */
  const collections = {};

  for (const key of Object.keys(tree)) {
    const [kind, rest] = key.split(':');
    if (kind === 'collection') {
      counts.collections++;
      collections[rest] = collections[rest] || { fields: [], relations: [] };
    } else if (kind === 'field') {
      counts.fields++;
      const [collection, field] = rest.split('.');
      collections[collection] = collections[collection] || { fields: [], relations: [] };
      collections[collection].fields.push(field);
    } else if (kind === 'relation') {
      counts.relations++;
      const [collection, field] = rest.split('.');
      collections[collection] = collections[collection] || { fields: [], relations: [] };
      collections[collection].relations.push(field);
    }
  }

  return { counts, collections };
}

module.exports = { buildTreeSummary };
