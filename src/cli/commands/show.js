const { GitStore } = require('../../core/store/git');

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
 * Returns Map<collection, fieldName[]> in insertion order.
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

function printGrouped(label, keys, detailFn, tree) {
  if (keys.length === 0) return;
  console.log(`\n  [${label}]`);
  const groups = groupByCollection(keys);
  let first = true;
  for (const [collection, entries] of groups) {
    if (!first) console.log('');
    first = false;
    console.log(`    ${collection}`);
    for (const { key, field } of entries) {
      const detail = detailFn(tree[key]);
      console.log(`      ${field}${detail}`);
    }
  }
}

/**
 * commander action handler for `show <id>`.
 *
 * Human output:
 *   - Collections: flat list
 *   - Fields: grouped by collection, system fields (id/dates/user_*) in separate block
 *   - Relations: grouped by collection, system relations in separate block
 * --json: full EntityTree as JSON (for UI / programmatic use).
 *
 * @param {string} id - commit SHA (full or short prefix from `list`)
 * @param {{storeDir: string, json?: boolean}} options
 */
async function cmdShow(id, options) {
  const store = new GitStore(options.storeDir);
  const tree = await store.get(id);
  const keys = Object.keys(tree).sort();

  if (options.json) {
    process.stdout.write(JSON.stringify(tree, null, 2) + '\n');
    return;
  }

  const byKind = {};
  for (const key of keys) {
    const kind = key.slice(0, key.indexOf(':'));
    (byKind[kind] = byKind[kind] || []).push(key);
  }

  const summary = Object.entries(byKind)
    .map(([k, arr]) => `${arr.length} ${k}${arr.length === 1 ? '' : 's'}`)
    .join(', ');
  console.log(`Version ${id.slice(0, 7)} — ${keys.length} entities (${summary}):`);

  // Collections — flat, no grouping needed
  const collections = byKind.collection || [];
  if (collections.length) {
    console.log('\n  [collection]');
    for (const key of collections) {
      console.log(`    ${key.slice(key.indexOf(':') + 1)}`);
    }
  }

  // Fields — grouped by collection, system separated
  const allFields = byKind.field || [];
  const realFields = allFields.filter((k) => !isSystemField(k.slice(k.lastIndexOf('.') + 1)));
  const systemFields = allFields.filter((k) => isSystemField(k.slice(k.lastIndexOf('.') + 1)));
  printGrouped('field', realFields, fieldDetail, tree);
  printGrouped('field / system', systemFields, fieldDetail, tree);

  // Relations — grouped by collection, system separated
  const allRelations = byKind.relation || [];
  const realRelations = allRelations.filter((k) => !isSystemRelation(k.slice(k.indexOf(':') + 1)));
  const systemRelations = allRelations.filter((k) => isSystemRelation(k.slice(k.indexOf(':') + 1)));
  printGrouped('relation', realRelations, relationDetail, tree);
  printGrouped('relation / system', systemRelations, relationDetail, tree);
}

module.exports = { cmdShow };
