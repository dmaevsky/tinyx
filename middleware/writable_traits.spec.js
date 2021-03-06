import test from 'ava';
import { tx } from '../tx.js';
import applyMiddleware from './index.js';
import writableTraits from './writable_traits.js';

const logger = log => ({ commit, ...rest }) => ({
  commit: (transaction, payload, ...keyPath) => {
    log.push(transaction.name);

    return commit(transaction, payload, ...keyPath);
  },
  ...rest
});

test('writable traits', t => {
  const log = [];
  const store = applyMiddleware(tx(null), [writableTraits, logger(log)]);

  store.set([55]);
  store.update(list => list.concat(42));

  t.deepEqual(log, ['SET', 'UPDATE']);
  t.deepEqual(store.get(), [55, 42]);
});
