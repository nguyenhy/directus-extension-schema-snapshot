// Not run by `npm test` — type-checked only, via `npm run test-types`.
// Exercises the public API surface (src/index.js) as an external TS
// consumer would, so a breaking type change here fails CI before publish.
import { createEnv, diffSchemas, entityKey, errors } from '../../src/index';

async function example(): Promise<void> {
  const { store, parse } = createEnv({ storeDir: '.snapshot' });
  const key: string = entityKey('collections', { collection: 'articles' });
  void store;
  void parse;
  void diffSchemas;
  void key;
  const err = new errors.SchemaSnapshotError('x');
  void err;
}

void example;
