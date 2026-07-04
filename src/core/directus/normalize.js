const { UnknownEntityKindError } = require('../errors');

/**
 * Directus system fields stripped from every entity, at every nesting level.
 * NOTE: this strip is recursive (see stripVolatile) — a field legitimately
 * named "id" anywhere inside a nested object (e.g. meta.options.choices[].id)
 * is dropped too, not just the entity's own top-level id.
 */
const VOLATILE_KEYS = new Set(['id', 'date_created', 'date_updated', 'user_created', 'user_updated']);

/**
 * Array-valued top-level schema sections -> singular key label.
 * Order here is also the order denormalize() emits them back in.
 */
const ARRAY_KINDS = {
  collections: 'collection',
  fields: 'field',
  systemfields: 'systemfield',
  relations: 'relation',
};

/** Primitive top-level schema fields, stored one-per-key under the "meta" label. */
const SCALAR_KINDS = ['version', 'directus', 'vendor'];

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
 * Builds the flat-map key for one array-section entity: "kind:index".
 * Deliberately index-based, not name-based — entity content (e.g.
 * item.collection) is attacker-controlled input and must never end up as
 * a filesystem path segment (see fsTree.js, which uses this key's "name"
 * half as a filename). Index is ours to assign, never derived from input.
 * @param {'collections'|'fields'|'systemfields'|'relations'} kind - plural schema section name
 * @param {number} index - position of the item within its section array
 * @returns {string} e.g. "collection:0", "field:12"
 * @throws {Error} if kind is not one of the known array section names
 */
function entityKey(kind, index) {
  const label = ARRAY_KINDS[kind];
  if (!label) {
    throw new UnknownEntityKindError(`Unknown entity kind "${kind}"`);
  }
  return `${label}:${index}`;
}

/**
 * Directus schema export -> flat map of entityKey -> cleaned entity.
 * Accepts either { data: { version, directus, vendor, collections, fields,
 * systemfields, relations } } or the bare (un-{data}-wrapped) shape.
 *
 * Scalar fields (version, directus, vendor) each become their own
 * "meta:<name>" entry. Array sections become "<kind>:<index>" entries, one
 * per item, keyed by position — never by item content.
 * @param {object} rawSchema - raw parsed JSON, Directus schema export shape
 * @returns {import('../normalizers').EntityTree}
 */
function normalize(rawSchema) {
  const root = (rawSchema && rawSchema.data) || rawSchema || {};
  const tree = {};

  for (const scalarKind of SCALAR_KINDS) {
    if (Object.prototype.hasOwnProperty.call(root, scalarKind)) {
      tree[`meta:${scalarKind}`] = stripVolatile(root[scalarKind]);
    }
  }

  for (const kind of Object.keys(ARRAY_KINDS)) {
    const items = Array.isArray(root[kind]) ? root[kind] : [];
    items.forEach((item, index) => {
      tree[entityKey(kind, index)] = stripVolatile(item);
    });
  }

  return tree;
}

/**
 * Denormalizes an EntityTree back into a raw Directus schema snapshot format.
 * Groups array-section entities by kind, sorted numerically by their
 * original index (NOT string-sorted — "10" must stay after "2"). Rebuilds
 * scalar fields (version/directus/vendor) from their "meta:*" entries.
 * @param {import('../normalizers').EntityTree} tree
 * @returns {object} Directus schema shape
 */
function denormalize(tree) {
  const grouped = { collection: [], field: [], systemfield: [], relation: [] };
  const scalars = {};

  for (const key of Object.keys(tree)) {
    const sepIdx = key.indexOf(':');
    const kind = key.slice(0, sepIdx);
    const rest = key.slice(sepIdx + 1);
    if (kind === 'meta') {
      scalars[rest] = tree[key];
    } else if (grouped[kind]) {
      grouped[kind].push([Number(rest), tree[key]]);
    }
  }

  for (const kind of Object.keys(grouped)) {
    grouped[kind].sort((a, b) => a[0] - b[0]);
  }

  return {
    data: {
      ...scalars,
      collections: grouped.collection.map(([, value]) => value),
      fields: grouped.field.map(([, value]) => value),
      systemfields: grouped.systemfield.map(([, value]) => value),
      relations: grouped.relation.map(([, value]) => value),
    },
  };
}

module.exports = { normalize, stripVolatile, entityKey, denormalize };
