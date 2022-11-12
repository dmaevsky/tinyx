import test from 'node:test';
import assert from 'node:assert/strict';

import { getIn, produce, tx, select, derived, writable } from '../tx.js';

test('getIn', () => {
  assert.equal(getIn({ a: 5 }, 'a'), 5);
  assert.equal(getIn('', 'length'), 0);
  assert.equal(getIn(null, 'foo'), undefined);
  assert.equal(getIn(undefined, 'foo'), undefined);
  assert.equal(getIn({a: 5}, 'a', 'b'), undefined);
});

test('produce', () => {
  let state = {}
  // state is not modified by a no-op mutation
  assert.equal(produce(() => undefined)(state), state);

  state = produce(({ set }) => {
    set('foo1', 'bar', 42);
    set('foo2', 'bar', 84);
  })(state);

  assert.deepEqual(state, { foo1: { bar: 42 }, foo2: { bar: 84 } });

  const complexMutation = ({ apply }) =>
    apply('foo1', ({ get, set, update }) => {
      set('barCopy', get('bar'));
      update('bar', value => 2 * value);
    });

  state = produce(complexMutation)(state);
  assert.deepEqual(state, { foo1: { barCopy: 42, bar: 84 }, foo2: { bar: 84 } });

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
  assert.deepEqual(state, {
    todos: [
      { what: 'Do something awesome', urgent: true, style: { color: 'red' } },
      { what: 'Chill' }
    ]
  });

});

test('tx store ops', () => {
  const store = tx(new Map());
  let test;
  const unsubscribe = store.subscribe(m => test = m.get('test'));

  assert.equal(test, undefined);

  // Transactions
  function SET_FOO(value) { return ({ set }) => set('test', 'foo', value) }
  function DOUBLE_FOO() { return ({ update }) => update('test', 'foo', value => value * 2) }
  function CLEAR() { return ({ remove }) => remove('test') }

  store.commit(SET_FOO, 42);
  assert.deepEqual(test, {foo: 42});
  assert.equal(store.get('test'), test);

  store.commit(DOUBLE_FOO);
  assert.deepEqual(test, {foo: 84});

  store.commit(CLEAR);
  assert.equal(test, undefined);

  unsubscribe();
});

test('a store with Sets and Maps', () => {
  const store = tx({
    a_map: new Map(),
    a_set: new Set()
  });

  // Transactions
  function TEST_SET(value) { return ({ set, update }) => set('a_map', 'key' + value, value) && update('a_set', s => new Set(s).add(value)) }
  function TEST_DELETE(value) { return ({ remove }) => remove('a_map', 'key' + value) && remove('a_set', value) }

  store.commit(TEST_SET, 1);
  store.commit(TEST_SET, 2);

  assert.deepEqual([...store.get('a_map')], [['key1', 1], ['key2', 2]]);
  assert.deepEqual([...store.get('a_set')], [1, 2]);

  store.commit(TEST_DELETE, 1);

  assert.deepEqual([...store.get('a_map')], [['key2', 2]]);
  assert.deepEqual([...store.get('a_set')], [2]);
});

test('multiple subscribers', () => {
  const store = tx(new Map());
  let test1, test2;

  const subscriptions = [
    store.subscribe(m => test1 = m.get('test')),
    store.subscribe(m => test2 = m.get('test'))
  ]

  assert.equal(test1, undefined);
  assert.equal(test2, undefined);

  // Transactions
  function SET_FOO(value) { return ({ set }) => set('test', 'foo', value) }

  store.commit(SET_FOO, 42);
  assert.deepEqual(test1, {foo: 42});
  assert.equal(test1, test2);

  for (let cleanup of subscriptions) cleanup();
})

test('selected stores', () => {
  const store = tx({ foo: 'fooVal', bar: 'barVal' });
  const active = select(store, store => [store.active]);

  let $store, $active;
  const subscriptions = [
    store.subscribe(s => $store = s),
    active.subscribe(s => $active = s)
  ];

  assert.equal($active, undefined);

  // Transactions
  function SET_ACTIVE(which) { return ({ set }) => set('active', which) }
  function TO_UPPERCASE() { return ({ update }) => update(value => value.toUpperCase()) }

  store.commit(SET_ACTIVE, 'foo');
  assert.equal($active, 'fooVal');

  store.commit(SET_ACTIVE, 'bar');
  assert.equal($active, 'barVal');

  active.commit(TO_UPPERCASE);
  assert.equal($active, 'BARVAL');
  assert.deepEqual($store, {active: 'bar', foo: 'fooVal', bar: 'BARVAL'});

  store.commit(TO_UPPERCASE, null, 'foo');
  assert.deepEqual($store, {active: 'bar', foo: 'FOOVAL', bar: 'BARVAL'});

  for (let cleanup of subscriptions) cleanup();
});

test('enforced immutability of the state', () => {
  const store = tx({ foo: new Map([['a', 1]]) });
  const foo = select(store, () => ['foo']);

  assert(foo.get() instanceof Map);

  assert.throws(() => foo.get().set('a', 2), new TypeError('Object is frozen'));
});

test('objects which are not Object, Map, or Set are not frozen', () => {
  class C {
    set(value) { this.value = value;  return this; }
  };
  const store = tx({ foo: new C() });
  const foo = select(store, () => ['foo']);

  function MUTATE_C() {
    return ({ update }) => update(c => c.set(42));
  }

  foo.commit(MUTATE_C);
  assert.equal(store.get('foo', 'value'), 42);
});

test('derived', () => {
  const store = tx({ activeIdx: 1, docs: ['foo', 'bar', 'baz'] });
  const active = derived(store, ({ activeIdx, docs }) => docs[activeIdx], (a, b) => a && b && a.toUpperCase() === b.toUpperCase());

  function SET_VALUE(value) {
    return ({ set }) => set(value);
  }

  const updates = [];
  assert.equal(active.get(), 'bar');

  active.subscribe(value => updates.push(value));

  assert.equal(active.get(), 'bar');

  store.commit(SET_VALUE, 'BAR', 'docs', 1);

  // Even if the actual value has changed, the derived store is case-insensitive
  assert.equal(active.get(), 'bar');

  store.commit(SET_VALUE, 2, 'activeIdx');
  assert.equal(active.get(), 'baz');

  assert.deepEqual(updates, ['bar', 'baz']);
});

test('writable.set returns false if nothing changed', () => {
  const w = writable(1);
  assert(!w.set(1));
  assert(w.set(2));
  assert(!w.update(s => s));
  assert(w.update(s => s + 1));
});

test('set and update produce no change if values remain the same', () => {
  const store = tx({ a: 5, b: 6 });

  function SET_AND_UPDATE({ a, update_b }) {
    return ({ set, update }) => {
      set('a', a);
      update('b', update_b);
    }
  }

  assert.equal(store.commit(SET_AND_UPDATE, { a: 5, update_b: b => b }).length, 0);
  assert.equal(store.commit(SET_AND_UPDATE, { a: 6, update_b: b => b }).length, 1);
  assert.equal(store.commit(SET_AND_UPDATE, { a: 6, update_b: b => b + 1 }).length, 1);
  assert.equal(store.commit(SET_AND_UPDATE, { a: 7, update_b: b => b + 1 }).length, 2);
});
