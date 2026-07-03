const { getNormalizer } = require('../normalizers');
const { diff } = require('../diff');
const { buildAddView } = require('../present/add');

/**
 * Normalizes a schema file and commits it as a new version — the full
 * "add" operation, independent of CLI vs UI. Callers (cmdAdd, a UI
 * backend, etc.) just choose how to render the returned view.
 * @param {{inputPath: string, schemaType: string, message?: string, store: import('../store/store').Store, parse: (filePath: string) => object}} params
 *   `store` and `parse` are required — injected dependencies from
 *   core/env.js, never constructed here. See core/operations/show.js for
 *   the store rationale; `parse` follows the same reasoning so a non-json
 *   file format never requires touching this file.
 * @returns {Promise<ReturnType<typeof buildAddView>>}
 */
async function addVersion({ inputPath, schemaType, message, store, parse }) {
  const { normalize } = getNormalizer(schemaType);
  const raw = parse(inputPath);
  const tree = normalize(raw);

  const { id, message: committedMessage, previousTree } = await store.set(tree, message, raw);

  const result = diff(previousTree, tree);
  return buildAddView(id, committedMessage, result, previousTree, tree);
}

module.exports = { addVersion };
