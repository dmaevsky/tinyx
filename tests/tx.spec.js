import test from 'ava';
import { getIn, produce, tx, select, derived, writable } from '../tx.js';

test('getIn', t => {
  t.is(getIn({ a: 5 }, 'a'), 5);
  t.is(getIn('', 'length'), 0);
  t.is(getIn(null, 'foo'), undefined);
  t.is(getIn(undefined, 'foo'), undefined);
  t.is(getIn({a: 5}, 'a', 'b'), undefined);
});

test('produce', t => {
  let state = {}
  // state is not modified by a no-op mutation
  t.is(produce(() => undefined)(state), state);

  state = produce(({ set }) => {
    set('foo1', 'bar', 42);
    set('foo2', 'bar', 84);
  })(state);

  t.deepEqual(state, { foo1: { bar: 42 }, foo2: { bar: 84 } });

  const complexMutation = ({ apply }) =>
    apply('foo1', ({ get, set, update }) => {
      set('barCopy', get('bar'));
      update('bar', value => 2 * value);
    });

  state = produce(complexMutation)(state);
  t.deepEqual(state, { foo1: { barCopy: 42, bar: 84 }, foo2: { bar: 84 } });

  state = {
    todos: [
      { what: 'Do something awesome', urgent: true },
      { what: 'Chill' }
    ]
  }

  // Transaction with a payload
  const highlightUrgent = color => ({ update }) => update('todos',
    todos => todos.map(produce(({ get, set }) => get('urgent') && set('style', 'color', color))));

  state = produce(highlightUrgent('red'))(state);
  t.deepEqual(state, {
    todos: [
      { what: 'Do something awesome', urgent: true, style: { color: 'red' } },
      { what: 'Chill' }
    ]
  });

});

test('tx store ops', t => {
  const store = tx(new Map());
  let test;
  const unsubscribe = store.subscribe(m => test = m.get('test'));

  t.is(test, undefined);

  // Transactions
  function SET_FOO(value) { return ({ set }) => set('test', 'foo', value) }
  function DOUBLE_FOO() { return ({ update }) => update('test', 'foo', value => value * 2) }
  function CLEAR() { return ({ remove }) => remove('test') }

  store.commit(SET_FOO, 42);
  t.deepEqual(test, {foo: 42});
  t.is(store.get('test'), test);

  store.commit(DOUBLE_FOO);
  t.deepEqual(test, {foo: 84});

  store.commit(CLEAR);
  t.is(test, undefined);

  unsubscribe();
});

test('a store with Sets and Maps', t => {
  const store = tx({
    a_map: new Map(),
    a_set: new Set()
  });

  // Transactions
  function TEST_SET(value) { return ({ set, update }) => set('a_map', 'key' + value, value) && update('a_set', s => new Set(s).add(value)) }
  function TEST_DELETE(value) { return ({ remove }) => remove('a_map', 'key' + value) && remove('a_set', value) }

  store.commit(TEST_SET, 1);
  store.commit(TEST_SET, 2);

  t.deepEqual([...store.get('a_map')], [['key1', 1], ['key2', 2]]);
  t.deepEqual([...store.get('a_set')], [1, 2]);

  store.commit(TEST_DELETE, 1);

  t.deepEqual([...store.get('a_map')], [['key2', 2]]);
  t.deepEqual([...store.get('a_set')], [2]);
});

test('multiple subscribers', t => {
  const store = tx(new Map());
  let test1, test2;

  const subscriptions = [
    store.subscribe(m => test1 = m.get('test')),
    store.subscribe(m => test2 = m.get('test'))
  ]

  t.is(test1, undefined);
  t.is(test2, undefined);

  // Transactions
  function SET_FOO(value) { return ({ set }) => set('test', 'foo', value) }

  store.commit(SET_FOO, 42);
  t.deepEqual(test1, {foo: 42});
  t.is(test1, test2);

  for (let cleanup of subscriptions) cleanup();
})

test('selected stores', t => {
  const store = tx({ foo: 'fooVal', bar: 'barVal' });
  const active = select(store, store => [store.active]);

  let $store, $active;
  const subscriptions = [
    store.subscribe(s => $store = s),
    active.subscribe(s => $active = s)
  ];

  t.is($active, undefined);

  // Transactions
  function SET_ACTIVE(which) { return ({ set }) => set('active', which) }
  function TO_UPPERCASE() { return ({ update }) => update(value => value.toUpperCase()) }

  store.commit(SET_ACTIVE, 'foo');
  t.is($active, 'fooVal');

  store.commit(SET_ACTIVE, 'bar');
  t.is($active, 'barVal');

  active.commit(TO_UPPERCASE);
  t.is($active, 'BARVAL');
  t.deepEqual($store, {active: 'bar', foo: 'fooVal', bar: 'BARVAL'});

  store.commit(TO_UPPERCASE, null, 'foo');
  t.deepEqual($store, {active: 'bar', foo: 'FOOVAL', bar: 'BARVAL'});

  for (let cleanup of subscriptions) cleanup();
});

test('enforced immutability of the state', t => {
  const store = tx({ foo: new Map([['a', 1]]) });
  const foo = select(store, () => ['foo']);

  t.throws(() => foo.update(map => map.set('a', 2)), { instanceOf: TypeError }, 'Object is frozen');
});

test('objects which are not Object, Map, or Set are not frozen', t => {
  class C {
    set(value) { this.value = value;  return this; }
  };
  const store = tx({ foo: new C() });
  const foo = select(store, () => ['foo']);

  function MUTATE_C() {
    return ({ update }) => update(c => c.set(42));
  }

  foo.commit(MUTATE_C);
  t.is(store.get('foo', 'value'), 42);
});

test('derived', t => {
  const store = tx({ activeIdx: 1, docs: ['foo', 'bar', 'baz'] });
  const active = derived(store, ({ activeIdx, docs }) => docs[activeIdx], (a, b) => a && b && a.toUpperCase() === b.toUpperCase());

  function SET_VALUE(value) {
    return ({ set }) => set(value);
  }

  const updates = [];
  t.is(active.get(), 'bar');

  active.subscribe(value => updates.push(value));

  t.is(active.get(), 'bar');

  store.commit(SET_VALUE, 'BAR', 'docs', 1);

  // Even if the actual value has changed, the derived store is case-insensitive
  t.is(active.get(), 'bar');

  store.commit(SET_VALUE, 2, 'activeIdx');
  t.is(active.get(), 'baz');

  t.deepEqual(updates, ['bar', 'baz']);
});

test('writable.set returns false if nothing changed', t => {
  const w = writable(1);
  t.false(w.set(1));
  t.true(w.set(2));
  t.false(w.update(s => s));
  t.true(w.update(s => s + 1));
});

test('set and update produce no change if values remain the same', t => {
  const store = tx({ a: 5, b: 6 });

  function SET_AND_UPDATE({ a, update_b }) {
    return ({ set, update }) => {
      set('a', a);
      update('b', update_b);
    }
  }

  t.is(store.commit(SET_AND_UPDATE, { a: 5, update_b: b => b }).length, 0);
  t.is(store.commit(SET_AND_UPDATE, { a: 6, update_b: b => b }).length, 1);
  t.is(store.commit(SET_AND_UPDATE, { a: 6, update_b: b => b + 1 }).length, 1);
  t.is(store.commit(SET_AND_UPDATE, { a: 7, update_b: b => b + 1 }).length, 2);
});
