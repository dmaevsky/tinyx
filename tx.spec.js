const test = require('ava');

const { produce, tx, select } = require('./tx')
const { writable } = require('svelte/store')

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
  const store = tx(writable(new Map()));
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

test('multiple subscribers', t => {
  const store = tx(writable(new Map()));
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
  const store = tx(writable({ foo: 'fooVal', bar: 'barVal' }));
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

  store.commit('foo', TO_UPPERCASE);
  t.deepEqual($store, {active: 'bar', foo: 'FOOVAL', bar: 'BARVAL'});

  for (let cleanup of subscriptions) cleanup();
});
