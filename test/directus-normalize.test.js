const assert = require('node:assert/strict');
const { test } = require('node:test');
const { normalize, stripVolatile, entityKey, denormalize } = require('../src/core/directus/normalize');
const { contentHash } = require('../src/core/hash');

test('entityKey: builds "kind:hash" for each known array kind, hash derived from identity fields only', () => {
  assert.equal(entityKey('collections', { collection: 'orders' }), `collection:${contentHash({ collection: 'orders' })}`);
  assert.equal(
    entityKey('fields', { collection: 'orders', field: 'status', type: 'string' }),
    `field:${contentHash({ collection: 'orders', field: 'status' })}`
  );
  assert.equal(
    entityKey('relations', { collection: 'orders', field: 'customer' }),
    `relation:${contentHash({ collection: 'orders', field: 'customer' })}`
  );
});

test('entityKey: same identity hashes identically even if other content differs (needed for "modified" detection)', () => {
  const keyV1 = entityKey('fields', { collection: 'orders', field: 'status', type: 'string' });
  const keyV2 = entityKey('fields', { collection: 'orders', field: 'status', type: 'enum' });
  assert.equal(keyV1, keyV2);
});

test('entityKey: different identity (attacker string vs. safe hash) never reaches the key as raw content', () => {
  const key = entityKey('collections', { collection: '../../../etc/passwd' });
  assert.doesNotMatch(key, /\.\./);
  assert.doesNotMatch(key, /\//);
});

test('entityKey: throws on unknown kind', () => {
  assert.throws(() => entityKey('bogus', {}), /Unknown entity kind "bogus"/);
});

test('stripVolatile: removes volatile keys at top level', () => {
  const out = stripVolatile({ id: 1, collection: 'orders', date_created: 'x' });
  assert.deepEqual(out, { collection: 'orders' });
});

test('stripVolatile: removes volatile keys recursively, including nested "id"', () => {
  const out = stripVolatile({
    collection: 'orders',
    meta: { options: { choices: [{ id: 1, text: 'a' }] } },
  });
  assert.deepEqual(out, {
    collection: 'orders',
    meta: { options: { choices: [{ text: 'a' }] } },
  });
});

test('stripVolatile: sorts object keys so equal content produces identical JSON', () => {
  const a = stripVolatile({ b: 2, a: 1 });
  const b = stripVolatile({ a: 1, b: 2 });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('normalize: builds flat EntityTree from bare {collections, fields, relations} shape', () => {
  const tree = normalize({
    collections: [{ id: 1, collection: 'orders' }],
    fields: [{ id: 2, collection: 'orders', field: 'status' }],
    relations: [],
  });
  assert.deepEqual(tree, {
    [`collection:${contentHash({ collection: 'orders' })}`]: { collection: 'orders' },
    [`field:${contentHash({ collection: 'orders', field: 'status' })}`]: { collection: 'orders', field: 'status' },
  });
});

test('normalize: attacker-controlled collection name never becomes a raw path-unsafe key', () => {
  const tree = normalize({
    collections: [{ collection: '../../../etc/passwd' }],
    fields: [],
    relations: [],
  });
  const [key] = Object.keys(tree);
  assert.doesNotMatch(key, /\.\.|\//);
  assert.equal(tree[key].collection, '../../../etc/passwd');
});

test('normalize: captures systemFields array and scalar version/directus/vendor fields', () => {
  const tree = normalize({
    version: 1,
    directus: '10.0.0',
    vendor: 'postgres',
    collections: [],
    fields: [],
    systemFields: [{ collection: 'orders', field: 'id' }],
    relations: [],
  });
  assert.deepEqual(tree, {
    'meta:version': 1,
    'meta:directus': '10.0.0',
    'meta:vendor': 'postgres',
    [`systemfield:${contentHash({ collection: 'orders', field: 'id' })}`]: { collection: 'orders', field: 'id' },
  });
});

test('normalize: accepts { data: {...} } wrapped shape identically', () => {
  const raw = { data: { collections: [{ id: 1, collection: 'orders' }], fields: [], relations: [] } };
  const tree = normalize(raw);
  assert.deepEqual(tree, { [`collection:${contentHash({ collection: 'orders' })}`]: { collection: 'orders' } });
});

test('normalize: non-Directus JSON returns {} (no matching sections/scalars found)', () => {
  assert.deepEqual(normalize({ foo: 'bar' }), {});
  assert.deepEqual(normalize({}), {});
});

test('denormalize: builds raw Directus schema format from EntityTree', () => {
  const tree = normalize({
    collections: [{ collection: 'orders' }],
    fields: [{ collection: 'orders', field: 'status' }],
    relations: [{ collection: 'orders', field: 'customer' }],
  });
  const raw = denormalize(tree);
  assert.deepEqual(raw, {
    data: {
      collections: [{ collection: 'orders' }],
      fields: [{ collection: 'orders', field: 'status' }],
      systemFields: [],
      relations: [{ collection: 'orders', field: 'customer' }],
    },
  });
});

test('denormalize: rebuilds scalar version/directus/vendor fields from "meta:*" entries', () => {
  const tree = { 'meta:version': 1, 'meta:directus': '10.0.0', 'meta:vendor': 'postgres' };
  const raw = denormalize(tree);
  assert.equal(raw.data.version, 1);
  assert.equal(raw.data.directus, '10.0.0');
  assert.equal(raw.data.vendor, 'postgres');
});

test('normalize -> denormalize round-trips the full shape (order not guaranteed, content is)', () => {
  const original = {
    data: {
      version: 1,
      directus: '10.0.0',
      vendor: 'postgres',
      collections: [{ collection: 'orders' }, { collection: 'customers' }],
      fields: [{ collection: 'orders', field: 'status' }],
      systemFields: [{ collection: 'orders', field: 'id' }],
      relations: [{ collection: 'orders', field: 'customer' }],
    },
  };
  const roundTripped = denormalize(normalize(original));
  assert.equal(roundTripped.data.version, 1);
  assert.equal(roundTripped.data.directus, '10.0.0');
  assert.equal(roundTripped.data.vendor, 'postgres');
  assert.deepEqual(new Set(roundTripped.data.collections.map((c) => c.collection)), new Set(['orders', 'customers']));
  assert.deepEqual(roundTripped.data.fields, [{ collection: 'orders', field: 'status' }]);
  assert.deepEqual(roundTripped.data.systemFields, [{ collection: 'orders', field: 'id' }]);
  assert.deepEqual(roundTripped.data.relations, [{ collection: 'orders', field: 'customer' }]);
});

test('normalize: identity-only key means "removed field X, added new field Y" is detected correctly (not as one giant modified)', () => {
  const v1 = normalize({ fields: [{ collection: 'orders', field: 'status', type: 'string' }, { collection: 'orders', field: 'legacy_flag', type: 'boolean' }] });
  const v2 = normalize({ fields: [{ collection: 'orders', field: 'status', type: 'enum' }, { collection: 'orders', field: 'tracking_number', type: 'string' }] });
  const { diff } = require('../src/core/diff');
  const result = diff(v1, v2);
  assert.equal(result.added.length, 1);
  assert.equal(result.removed.length, 1);
  assert.equal(result.modified.length, 1);
});
