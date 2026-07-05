/**
 * Buckets an EntityTree's keys by kind into counts + a per-collection
 * fields/relations breakdown. Shared by core/operations/normalize.js's
 * buildMeta() and core/operations/extract.js's buildExtractMeta() — both
 * built the identical run-summary shape, so it lives here once.
 * Reads collection/field identity from each entity's own value (e.g.
 * entity.collection), not from the tree key — keys are index-based
 * ("kind:0") since core/directus/normalize.js's entityKey() change, so the
 * name is only ever available on the value.
 * @param {import('./normalizers').EntityTree} tree
 * @returns {{counts: {collections: number, fields: number, systemfields: number, relations: number}, collections: Object.<string, {fields: string[], systemfields: string[], relations: string[]}>}}
 */
function buildTreeSummary(tree) {
  const counts = { collections: 0, fields: 0, systemfields: 0, relations: 0 };
  /** @type {Object.<string, {fields: string[], systemfields: string[], relations: string[]}>} */
  const collections = {};

  const ensure = (name) => {
    collections[name] = collections[name] || { fields: [], systemfields: [], relations: [] };
    return collections[name];
  };

  for (const key of Object.keys(tree)) {
    const kind = key.slice(0, key.indexOf(':'));
    const entity = tree[key];
    if (kind === 'collection') {
      counts.collections++;
      ensure(entity.collection);
    } else if (kind === 'field') {
      counts.fields++;
      ensure(entity.collection).fields.push(entity.field);
    } else if (kind === 'systemfield') {
      counts.systemfields++;
      ensure(entity.collection).systemfields.push(entity.field);
    } else if (kind === 'relation') {
      counts.relations++;
      ensure(entity.collection).relations.push(entity.field);
    }
  }

  return { counts, collections };
}

module.exports = { buildTreeSummary };
