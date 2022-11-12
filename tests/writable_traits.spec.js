import test from 'node:test';
import assert from 'node:assert/strict';

import { tx } from '../tx.js';
import applyMiddleware from '../middleware/index.js';
import writableTraits from '../middleware/writable_traits.js';

const logger = log => ({ commit, ...rest }) => ({
  commit: (transaction, payload, ...keyPath) => {
    log.push(transaction.name);

    return commit(transaction, payload, ...keyPath);
  },
  ...rest
});

test('writable traits', () => {
  const log = [];
  const store = applyMiddleware(tx(null), [writableTraits, logger(log)]);

  store.set([55]);
  store.update(list => list.concat(42));

  assert.deepEqual(log, ['SET', 'UPDATE']);
  assert.deepEqual(store.get(), [55, 42]);
});
