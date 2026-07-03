const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after } = require('node:test');
const { GitStore } = require('../src/core/store/git');
const { runStoreContractTests } = require('./store.contract');

const tmpDirs = [];
after(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function makeStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-snapshot-git-store-'));
  tmpDirs.push(dir);
  return new GitStore(dir);
}

runStoreContractTests('GitStore', makeStore);
