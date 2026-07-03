const assert = require('node:assert/strict');
const { test } = require('node:test');

/**
 * Shared behavioral contract every Store implementation must pass — see
 * core/store/store.js for the interface this exercises. Run it against a
 * new implementation the same way test/git-store.test.js runs it against
 * GitStore, to catch behavior drift (not just a mismatched method name)
 * before it reaches core/operations/*.js.
 * @param {string} label - implementation name, used in test titles
 * @param {() => import('../src/core/store/store').Store} makeStore - fresh, empty store per call
 */
function runStoreContractTests(label, makeStore) {
  test(`${label}: list() on an empty store returns []`, async () => {
    const store = makeStore();
    assert.deepEqual(await store.list(), []);
  });

  test(`${label}: set() then get() round-trips the tree`, async () => {
    const store = makeStore();
    const tree = { 'collection:orders': { collection: 'orders', meta: { note: 'x' } } };
    const { id } = await store.set(tree, 'first');
    assert.deepEqual(await store.get(id), tree);
  });

  test(`${label}: set() reports previousTree as {} on the first commit`, async () => {
    const store = makeStore();
    const { previousTree } = await store.set({ 'collection:a': { collection: 'a' } }, 'first');
    assert.deepEqual(previousTree, {});
  });

  test(`${label}: set() reports previousTree as the prior version on later commits`, async () => {
    const store = makeStore();
    const treeA = { 'collection:a': { collection: 'a' } };
    await store.set(treeA, 'first');
    const treeB = { 'collection:a': { collection: 'a' }, 'collection:b': { collection: 'b' } };
    const { previousTree } = await store.set(treeB, 'second');
    assert.deepEqual(previousTree, treeA);
  });

  test(`${label}: list() returns versions newest first`, async () => {
    const store = makeStore();
    await store.set({ 'collection:a': { collection: 'a' } }, 'first');
    await store.set({ 'collection:b': { collection: 'b' } }, 'second');
    const versions = await store.list();
    assert.equal(versions.length, 2);
    assert.equal(versions[0].message, 'second');
    assert.equal(versions[1].message, 'first');
  });

  test(`${label}: diffVersions() always returns old→new regardless of argument order`, async () => {
    const store = makeStore();
    const treeA = { 'collection:a': { collection: 'a' } };
    const treeB = { 'collection:a': { collection: 'a' }, 'collection:b': { collection: 'b' } };
    const { id: idA } = await store.set(treeA, 'first');
    const { id: idB } = await store.set(treeB, 'second');

    const forward = await store.diffVersions(idA, idB);
    const backward = await store.diffVersions(idB, idA);

    assert.equal(forward.idOld, idA);
    assert.equal(forward.idNew, idB);
    assert.deepEqual(forward.result, backward.result);
    assert.equal(backward.idOld, idA);
    assert.equal(backward.idNew, idB);
  });
}

module.exports = { runStoreContractTests };
