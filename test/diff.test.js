const assert = require('node:assert/strict');
const { test } = require('node:test');
const { diff, changedPaths } = require('../src/core/diff');

test('changedPaths: flat scalar change reports one leaf', () => {
  const changes = changedPaths({ a: 1, b: 2 }, { a: 1, b: 3 });
  assert.deepEqual(changes, [{ path: 'b', from: 2, to: 3 }]);
});

test('changedPaths: recurses into nested plain objects', () => {
  const changes = changedPaths({ meta: { interface: 'x' } }, { meta: { interface: 'y' } });
  assert.deepEqual(changes, [{ path: 'meta.interface', from: 'x', to: 'y' }]);
});

test('changedPaths: array change reported as one whole-value change, not per-element', () => {
  const changes = changedPaths(
    { options: { choices: [{ id: 1 }, { id: 2 }] } },
    { options: { choices: [{ id: 1 }, { id: 3 }] } },
  );
  assert.deepEqual(changes, [
    { path: 'options.choices', from: [{ id: 1 }, { id: 2 }], to: [{ id: 1 }, { id: 3 }] },
  ]);
});

test('changedPaths: key order does not matter (relies on sorted-key input)', () => {
  const changes = changedPaths({ a: 1, b: 2 }, { b: 2, a: 1 });
  assert.deepEqual(changes, []);
});

test('changedPaths: added/removed keys reported with undefined on the missing side', () => {
  const changes = changedPaths({ a: 1 }, { a: 1, b: 2 });
  assert.deepEqual(changes, [{ path: 'b', from: undefined, to: 2 }]);
});

test('diff: entity present in both old and new with no changes is not modified', () => {
  const tree = { 'collection:orders': { collection: 'orders' } };
  const result = diff(tree, tree);
  assert.deepEqual(result, { added: [], removed: [], modified: [] });
});

test('diff: entity only in new tree is added', () => {
  const treeOld = {};
  const treeNew = { 'collection:orders': { collection: 'orders' } };
  const result = diff(treeOld, treeNew);
  assert.deepEqual(result, { added: ['collection:orders'], removed: [], modified: [] });
});

test('diff: entity only in old tree is removed', () => {
  const treeOld = { 'collection:orders': { collection: 'orders' } };
  const treeNew = {};
  const result = diff(treeOld, treeNew);
  assert.deepEqual(result, { added: [], removed: ['collection:orders'], modified: [] });
});

test('diff: entity present in both with changed fields is modified, with leaf changes', () => {
  const treeOld = { 'collection:orders': { collection: 'orders', meta: { note: 'x' } } };
  const treeNew = { 'collection:orders': { collection: 'orders', meta: { note: 'y' } } };
  const result = diff(treeOld, treeNew);
  assert.deepEqual(result, {
    added: [],
    removed: [],
    modified: [{ key: 'collection:orders', changes: [{ path: 'meta.note', from: 'x', to: 'y' }] }],
  });
});

test('diff: no rename detection — remove+add for a differently-keyed entity, not a rename', () => {
  const treeOld = { 'field:orders.status': { collection: 'orders', field: 'status' } };
  const treeNew = { 'field:orders.state': { collection: 'orders', field: 'state' } };
  const result = diff(treeOld, treeNew);
  assert.deepEqual(result, {
    added: ['field:orders.state'],
    removed: ['field:orders.status'],
    modified: [],
  });
});
