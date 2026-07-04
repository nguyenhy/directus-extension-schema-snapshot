const { UnknownEntityKindError } = require('../errors');
const { contentHash } = require('../hash');

/**
 * Directus system fields stripped from every entity, at every nesting level.
 * NOTE: this strip is recursive (see stripVolatile) — a field legitimately
 * named "id" anywhere inside a nested object (e.g. meta.options.choices[].id)
 * is dropped too, not just the entity's own top-level id.
 */
const VOLATILE_KEYS = new Set(['id', 'date_created', 'date_updated', 'user_created', 'user_updated']);

/**
 * Array-valued top-level schema sections -> singular key label.
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
 * Builds the identity descriptor a key's hash is derived from: what the
 * entity actually IS (collection, or collection+field), not its full
 * content. Keeping this independent of e.g. `type`/`meta` is what lets the
 * same field be recognized as "modified" (same key, different content)
 * across versions instead of showing up as a remove+add.
 * @param {'collections'|'fields'|'systemfields'|'relations'} kind
 * @param {object} item
 * @returns {object}
 */
function entityIdentity(kind, item) {
  return kind === 'collections' ? { collection: item.collection } : { collection: item.collection, field: item.field };
}

/**
 * Builds the flat-map key for one array-section entity: "kind:hash".
 * `hash` is a content hash of the entity's identity fields (collection,
 * or collection+field) — NEVER the raw field content used directly as a
 * filename. This is deliberate: item.collection/item.field are
 * attacker-controlled input, and this key's "hash" half ends up as a
 * filesystem path segment (see fsTree.js). Hashing keeps the same
 * collection/field pair mapping to the same key across versions (so
 * add/remove/modified detection in diff.js still works by identity), while
 * guaranteeing the key is always a safe fixed-charset string regardless of
 * what the source content contains.
 * @param {'collections'|'fields'|'systemfields'|'relations'} kind - plural schema section name
 * @param {object} item - raw item from that section
 * @returns {string} e.g. "collection:3f2b9c...", "field:9a01de..."
 * @throws {Error} if kind is not one of the known array section names
 */
function entityKey(kind, item) {
  const label = ARRAY_KINDS[kind];
  if (!label) {
    throw new UnknownEntityKindError(`Unknown entity kind "${kind}"`);
  }
  return `${label}:${contentHash(entityIdentity(kind, item))}`;
}

/**
 * Directus schema export -> flat map of entityKey -> cleaned entity.
 * Accepts either { data: { version, directus, vendor, collections, fields,
 * systemfields, relations } } or the bare (un-{data}-wrapped) shape.
 *
 * Scalar fields (version, directus, vendor) each become their own
 * "meta:<name>" entry. Array sections become "<kind>:<hash>" entries, one
 * per item — see entityKey() for why the key is a hash of identity, not
 * the raw name.
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
    for (const item of items) {
      tree[entityKey(kind, item)] = stripVolatile(item);
    }
  }

  return tree;
}

/**
 * Denormalizes an EntityTree back into a raw Directus schema snapshot format.
 * Groups array-section entities by kind, sorted stably by key (hashes have
 * no meaningful order, so this is deterministic output, not original-array-
 * order-preserving — same guarantee the old name-based keys gave). Rebuilds
 * scalar fields (version/directus/vendor) from their "meta:*" entries.
 * @param {import('../normalizers').EntityTree} tree
 * @returns {object} Directus schema shape
 */
function denormalize(tree) {
  const grouped = { collection: [], field: [], systemfield: [], relation: [] };
  const scalars = {};

  const keys = Object.keys(tree).sort();
  for (const key of keys) {
    const sepIdx = key.indexOf(':');
    const kind = key.slice(0, sepIdx);
    const rest = key.slice(sepIdx + 1);
    if (kind === 'meta') {
      scalars[rest] = tree[key];
    } else if (grouped[kind]) {
      grouped[kind].push(tree[key]);
    }
  }

  return {
    data: {
      ...scalars,
      collections: grouped.collection,
      fields: grouped.field,
      systemfields: grouped.systemfield,
      relations: grouped.relation,
    },
  };
}

module.exports = { normalize, stripVolatile, entityKey, denormalize };
