/**
 * One-line detail suffix for any entity key.
 * Fields: "(type, interface)". Relations: "→ related_collection". Others: "".
 */
function entityDetail(key, entity) {
  const kind = key.slice(0, key.indexOf(':'));
  if (kind === 'field') {
    const parts = [];
    if (entity.type) parts.push(entity.type);
    if (entity.meta && entity.meta.interface) parts.push(entity.meta.interface);
    return parts.length ? `  (${parts.join(', ')})` : '';
  }
  if (kind === 'relation') {
    const rel = entity.related_collection || (entity.meta && entity.meta.one_collection);
    return rel ? `  → ${rel}` : '';
  }
  return '';
}

/**
 * Builds a render-agnostic view of a diff result — the shape both CLI
 * printing and any future UI should consume, instead of re-deriving
 * per-entity detail strings from raw trees themselves.
 * @param {import('../diff').DiffResult} result
 * @param {import('../normalizers').EntityTree} treeOld
 * @param {import('../normalizers').EntityTree} treeNew
 * @returns {{
 *   added: {key: string, detail: string}[],
 *   modified: {key: string, changes: object[]}[],
 *   removed: {key: string, detail: string}[],
 *   summary: {addedCount: number, modifiedCount: number, removedCount: number},
 * }}
 */
function buildDiffView(result, treeOld, treeNew) {
  return {
    added: result.added.map((key) => ({ key, detail: entityDetail(key, treeNew[key]) })),
    modified: result.modified,
    removed: result.removed.map((key) => ({ key, detail: entityDetail(key, treeOld[key]) })),
    summary: {
      addedCount: result.added.length,
      modifiedCount: result.modified.length,
      removedCount: result.removed.length,
    },
  };
}

module.exports = { buildDiffView, entityDetail };
