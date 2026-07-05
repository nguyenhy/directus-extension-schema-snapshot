const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getNormalizer } = require('../src/core/normalizers/index');
const { getParser } = require('../src/core/parsers/index');

test('getNormalizer: returns the registered "directus" normalizer', () => {
  const normalizer = getNormalizer('directus');
  assert.equal(typeof normalizer.normalize, 'function');
});

test('getNormalizer: throws a clear error for an unknown type', () => {
  assert.throws(() => getNormalizer('bogus'), /Unknown schema type "bogus".*Available: directus/);
});

test('getParser: returns the registered "json" parser', () => {
  const parser = getParser('json');
  assert.equal(typeof parser.parse, 'function');
});

test('getParser: throws a clear error for an unknown format', () => {
  assert.throws(() => getParser('bogus'), /Unknown file format "bogus".*Available: json/);
});
