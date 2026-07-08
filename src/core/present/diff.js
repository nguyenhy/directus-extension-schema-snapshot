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
 * Human-readable stand-in for an entity key's hash half, e.g.
 * "field:c17837492016" -> "field:posts.title". The hash exists only to
 * keep normalize.js's EntityTree keys filesystem-safe (see
 * entityKey()'s GOTCHA in core/directus/normalize.js) — it carries no
 * meaning for a human reading a diff. The real identity (collection,
 * optionally field) is present in the entity content itself, so this just
 * reads it back out instead of re-deriving anything.
 * @param {string} key - "kind:hash" entity key
 * @param {object} entity - the entity content for that key, from either tree
 * @returns {string} "kind:collection" or "kind:collection.field"
 */
function entityLabel(key, entity) {
  const kind = key.slice(0, key.indexOf(':'));
  if (kind === 'meta' || !entity) return key;
  const identity = entity.field ? `${entity.collection}.${entity.field}` : entity.collection;
  return `${kind}:${identity}`;
}

/**
 * Builds a render-agnostic view of a diff result — the shape both CLI
 * printing and any future UI should consume, instead of re-deriving
 * per-entity detail strings from raw trees themselves.
 * @param {import('../diff').DiffResult} result
 * @param {import('../normalizers').EntityTree} treeOld
 * @param {import('../normalizers').EntityTree} treeNew
 * @returns {{
 *   added: {key: string, label: string, detail: string}[],
 *   modified: {key: string, label: string, changes: object[]}[],
 *   removed: {key: string, label: string, detail: string}[],
 *   summary: {addedCount: number, modifiedCount: number, removedCount: number},
 * }}
 */
function buildDiffView(result, treeOld, treeNew) {
  return {
    added: result.added.map((key) => ({
      key,
      label: entityLabel(key, treeNew[key]),
      detail: entityDetail(key, treeNew[key]),
    })),
    modified: result.modified.map(({ key, changes }) => ({
      key,
      label: entityLabel(key, treeNew[key] || treeOld[key]),
      changes,
    })),
    removed: result.removed.map((key) => ({
      key,
      label: entityLabel(key, treeOld[key]),
      detail: entityDetail(key, treeOld[key]),
    })),
    summary: {
      addedCount: result.added.length,
      modifiedCount: result.modified.length,
      removedCount: result.removed.length,
    },
  };
}

module.exports = { buildDiffView, entityDetail, entityLabel };
