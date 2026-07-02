/**
 * Equality via JSON.stringify comparison — NOT a true structural equality
 * check. Relies on both inputs having already-sorted object keys (which
 * normalize.js's stripVolatile() guarantees); two objects with the same
 * keys/values in different order would compare unequal here.
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Leaf-path diff between two entity objects, e.g. "type" or "meta.interface".
 * GOTCHA: only recurses into plain objects. Arrays are compared as whole
 * values via deepEqual() — a single changed element inside a large array
 * (e.g. Directus `options.choices`) reports the entire old/new array as
 * one change, not a per-element diff.
 * @param {object} [oldEntity]
 * @param {object} [newEntity]
 * @param {string} [prefix] - dot-path prefix, used internally for recursion
 * @returns {{path: string, from: *, to: *}[]} list of leaf-level changes
 */
function changedPaths(oldEntity, newEntity, prefix = '') {
  const changes = [];
  const keys = new Set([...Object.keys(oldEntity || {}), ...Object.keys(newEntity || {})]);
  for (const key of [...keys].sort()) {
    const path = prefix ? `${prefix}.${key}` : key;
    const oldVal = oldEntity ? oldEntity[key] : undefined;
    const newVal = newEntity ? newEntity[key] : undefined;
    const bothObjects =
      oldVal && newVal && typeof oldVal === 'object' && typeof newVal === 'object' &&
      !Array.isArray(oldVal) && !Array.isArray(newVal);
    if (bothObjects) {
      changes.push(...changedPaths(oldVal, newVal, path));
    } else if (!deepEqual(oldVal, newVal)) {
      changes.push({ path, from: oldVal, to: newVal });
    }
  }
  return changes;
}

/**
 * Structural diff between two normalize()-output trees, keyed by entity key
 * (see normalize.js's entityKey()). No rename detection — an entity that
 * disappears from treeOld and a differently-keyed one that appears in
 * treeNew are always reported as a separate removal + addition, never
 * inferred as a rename.
 * @param {import('./normalizers').EntityTree} treeOld
 * @param {import('./normalizers').EntityTree} treeNew
 * @returns {{added: string[], removed: string[], modified: {key: string, changes: object[]}[]}}
 */
function diff(treeOld, treeNew) {
  const oldKeys = new Set(Object.keys(treeOld));
  const newKeys = new Set(Object.keys(treeNew));

  const added = [...newKeys].filter((k) => !oldKeys.has(k)).sort();
  const removed = [...oldKeys].filter((k) => !newKeys.has(k)).sort();
  const modified = [];

  for (const key of [...oldKeys].filter((k) => newKeys.has(k)).sort()) {
    if (!deepEqual(treeOld[key], treeNew[key])) {
      modified.push({ key, changes: changedPaths(treeOld[key], treeNew[key]) });
    }
  }

  return { added, removed, modified };
}

module.exports = { diff, changedPaths };
