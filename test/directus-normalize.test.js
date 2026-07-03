const assert = require('node:assert/strict');
const { test } = require('node:test');
const { normalize, stripVolatile, entityKey, denormalize } = require('../src/core/directus/normalize');

test('entityKey: builds "kind:name" for each known kind', () => {
  assert.equal(entityKey('collections', { collection: 'orders' }), 'collection:orders');
  assert.equal(entityKey('fields', { collection: 'orders', field: 'status' }), 'field:orders.status');
  assert.equal(entityKey('relations', { collection: 'orders', field: 'customer' }), 'relation:orders.customer');
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
    'collection:orders': { collection: 'orders' },
    'field:orders.status': { collection: 'orders', field: 'status' },
  });
});

test('normalize: accepts { data: {...} } wrapped shape identically', () => {
  const raw = { data: { collections: [{ id: 1, collection: 'orders' }], fields: [], relations: [] } };
  const tree = normalize(raw);
  assert.deepEqual(tree, { 'collection:orders': { collection: 'orders' } });
});

test('normalize: GOTCHA — non-Directus JSON silently returns {} instead of throwing', () => {
  assert.deepEqual(normalize({ foo: 'bar' }), {});
  assert.deepEqual(normalize({}), {});
});

test('denormalize: builds raw Directus schema format from EntityTree', () => {
  const tree = {
    'collection:orders': { collection: 'orders' },
    'field:orders.status': { collection: 'orders', field: 'status' },
    'relation:orders.customer': { collection: 'orders', field: 'customer' },
  };
  const raw = denormalize(tree);
  assert.deepEqual(raw, {
    data: {
      collections: [{ collection: 'orders' }],
      fields: [{ collection: 'orders', field: 'status' }],
      relations: [{ collection: 'orders', field: 'customer' }],
    },
  });
});

test('denormalize: stably sorts outputs by EntityTree key', () => {
  const tree = {
    'field:orders.status': { collection: 'orders', field: 'status' },
    'collection:orders': { collection: 'orders' },
  };
  const raw = denormalize(tree);
  assert.deepEqual(raw.data.collections, [{ collection: 'orders' }]);
  assert.deepEqual(raw.data.fields, [{ collection: 'orders', field: 'status' }]);
});

