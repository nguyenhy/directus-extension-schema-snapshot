// Field names that are Directus-generated on every collection — shown last.
const SYSTEM_FIELD_NAMES = new Set(['id', 'date_created', 'date_updated', 'user_created', 'user_updated']);

// Relation field suffixes that are Directus-generated — shown last.
const SYSTEM_RELATION_SUFFIXES = ['user_created', 'user_updated', 'date_created', 'date_updated'];

function isSystemField(fieldName) {
  return SYSTEM_FIELD_NAMES.has(fieldName);
}

function isSystemRelation(name) {
  return SYSTEM_RELATION_SUFFIXES.some((s) => name.endsWith(`.${s}`));
}

/** "type: string, interface: input" → "(string, input)" */
function fieldDetail(entity) {
  const parts = [];
  if (entity.type) parts.push(entity.type);
  if (entity.meta && entity.meta.interface) parts.push(entity.meta.interface);
  return parts.length ? `  (${parts.join(', ')})` : '';
}

function relationDetail(entity) {
  const rel = entity.related_collection || (entity.meta && entity.meta.one_collection);
  return rel ? `  → ${rel}` : '';
}

/**
 * Group an array of "kind:collection.field" keys by their collection part.
 * Returns Map<collection, {key, field}[]> in insertion order.
 */
function groupByCollection(keys) {
  const map = new Map();
  for (const key of keys) {
    const name = key.slice(key.indexOf(':') + 1);
    const dotIdx = name.indexOf('.');
    const collection = dotIdx === -1 ? name : name.slice(0, dotIdx);
    const field = dotIdx === -1 ? '' : name.slice(dotIdx + 1);
    if (!map.has(collection)) map.set(collection, []);
    map.get(collection).push({ key, field });
  }
  return map;
}

function buildGroupView(keys, detailFn, tree) {
  const groups = [];
  for (const [collection, entries] of groupByCollection(keys)) {
    groups.push({
      collection,
      fields: entries.map(({ key, field }) => ({ key, field, detail: detailFn(tree[key]) })),
    });
  }
  return groups;
}

/**
 * Builds a render-agnostic view of a single version's tree — same shape
 * both CLI printing and any future UI should consume.
 * @param {string} id - commit SHA (full or short)
 * @param {import('../normalizers').EntityTree} tree
 * @returns {{
 *   id: string,
 *   summary: {kind: string, count: number}[],
 *   entityCount: number,
 *   collections: string[],
 *   fieldGroups: {collection: string, fields: object[]}[],
 *   systemFieldGroups: {collection: string, fields: object[]}[],
 *   relationGroups: {collection: string, fields: object[]}[],
 *   systemRelationGroups: {collection: string, fields: object[]}[],
 * }}
 */
function buildShowView(id, tree) {
  const keys = Object.keys(tree).sort();

  const byKind = {};
  for (const key of keys) {
    const kind = key.slice(0, key.indexOf(':'));
    (byKind[kind] = byKind[kind] || []).push(key);
  }
  const summary = Object.entries(byKind).map(([kind, arr]) => ({ kind, count: arr.length }));

  const collections = (byKind.collection || []).map((key) => key.slice(key.indexOf(':') + 1));

  const allFields = byKind.field || [];
  const realFields = allFields.filter((k) => !isSystemField(k.slice(k.lastIndexOf('.') + 1)));
  const systemFields = allFields.filter((k) => isSystemField(k.slice(k.lastIndexOf('.') + 1)));

  const allRelations = byKind.relation || [];
  const realRelations = allRelations.filter((k) => !isSystemRelation(k.slice(k.indexOf(':') + 1)));
  const systemRelations = allRelations.filter((k) => isSystemRelation(k.slice(k.indexOf(':') + 1)));

  return {
    id,
    summary,
    entityCount: keys.length,
    collections,
    fieldGroups: buildGroupView(realFields, fieldDetail, tree),
    systemFieldGroups: buildGroupView(systemFields, fieldDetail, tree),
    relationGroups: buildGroupView(realRelations, relationDetail, tree),
    systemRelationGroups: buildGroupView(systemRelations, relationDetail, tree),
  };
}

module.exports = { buildShowView };
