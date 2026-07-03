const { GitStore } = require('./store/git');
const { getParser } = require('./parsers');

/**
 * Composition root — the only place a concrete Store or Parser
 * implementation is chosen and constructed. Nothing else in the codebase
 * (cli included) does `new GitStore(...)` or picks a parser directly;
 * callers pass config in, get back ready-to-use dependencies, and stay
 * ignorant of what backs them. Swapping git for a DB-backed store, or
 * json for yaml, means adding one branch/registry entry here — every
 * caller (CLI today, a UI backend tomorrow) is unaffected.
 * @param {{
 *   storeDir: string,
 *   storeType?: 'git',
 *   fileFormat?: 'json',
 * }} config
 *   storeType: which Store to construct — see createStore() below for
 *   every accepted value (only "git" today; add a case there + here to
 *   extend the union when a second implementation exists).
 *   fileFormat: which Parser to construct — must match a key registered
 *   in core/parsers/index.js (only "json" today; extend the union there
 *   in lockstep with new registry entries).
 * @returns {{store: import('./store/store').Store, parse: (filePath: string) => object}}
 */
function createEnv({ storeDir, storeType = 'git', fileFormat = 'json' }) {
  const store = createStore(storeType, storeDir);
  const { parse } = getParser(fileFormat);
  return { store, parse };
}

function createStore(storeType, storeDir) {
  switch (storeType) {
    case 'git':
      return new GitStore(storeDir);
    default:
      throw new Error(`Unknown store type "${storeType}". Available: git`);
  }
}

module.exports = { createEnv };
