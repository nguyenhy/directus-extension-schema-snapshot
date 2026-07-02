/**
 * Directus system fields stripped from every entity, at every nesting level.
 * NOTE: this strip is recursive (see stripVolatile) — a field legitimately
 * named "id" anywhere inside a nested object (e.g. meta.options.choices[].id)
 * is dropped too, not just the entity's own top-level id.
 */
const VOLATILE_KEYS = new Set(['id', 'date_created', 'date_updated', 'user_created', 'user_updated']);

/**
 * Recursively strips VOLATILE_KEYS and sorts remaining object keys.
 * Sorting is not cosmetic — diff.js's deepEqual() relies on stable key
 * order (it compares via JSON.stringify, not structural equality), so this
 * function is the only thing making that comparison correct.
 * @param {*} value - any JSON-compatible value (object, array, or primitive)
 * @returns {*} same shape as input, volatile keys removed, object keys sorted
 */
function stripVolatile(value) {
  if (Array.isArray(value)) {
    return value.map(stripVolatile);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (VOLATILE_KEYS.has(key)) continue;
      out[key] = stripVolatile(value[key]);
    }
    return out;
  }
  return value;
}

/**
 * Builds the flat-map key for one entity: "kind:name".
 * This "kind:name" string is a de facto wire format — downstream code
 * parses it back apart via string-split (fsTree.js splits on ":", then
 * cli/commands/normalize.js's buildMeta() further splits the name on "."
 * for field/relation entries). Changing this format breaks both without
 * any compile-time warning.
 * @param {'collections'|'fields'|'relations'} kind - plural Directus schema section name
 * @param {object} item - raw item from that section (must have .collection, and .field for fields/relations)
 * @returns {string} e.g. "collection:orders", "field:orders.status", "relation:orders.customer"
 * @throws {Error} if kind is not one of the three known values
 */
function entityKey(kind, item) {
  if (kind === 'collections') return `collection:${item.collection}`;
  if (kind === 'fields') return `field:${item.collection}.${item.field}`;
  if (kind === 'relations') return `relation:${item.collection}.${item.field}`;
  throw new Error(`Unknown entity kind "${kind}"`);
}

/**
 * Directus schema export -> flat map of entityKey -> cleaned entity.
 * Accepts either { data: { collections, fields, relations } } or the bare
 * { collections, fields, relations } shape.
 *
 * GOTCHA: this function is Directus-shape-specific, not generic JSON
 * normalization — it only reads root.collections/fields/relations. If none
 * of those arrays are present (e.g. arbitrary non-Directus JSON, or an
 * already-normalized tree fed back in), it silently returns an empty
 * object `{}` rather than throwing. No warning is printed.
 * @param {object} rawSchema - raw parsed JSON, Directus schema export shape
 * @returns {import('../normalizers').EntityTree}
 */
function normalize(rawSchema) {
  const root = rawSchema && rawSchema.data ? rawSchema.data : rawSchema;
  const tree = {};
  for (const kind of ['collections', 'fields', 'relations']) {
    const items = Array.isArray(root[kind]) ? root[kind] : [];
    for (const item of items) {
      const key = entityKey(kind, item);
      tree[key] = stripVolatile(item);
    }
  }
  return tree;
}

module.exports = { normalize, stripVolatile, entityKey };
