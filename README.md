# tinyX
A tiny state manager for big applications

## Why tinyX ?
* [Redux](https://redux.js.org/) inspired
* No boilerplate
* Zero dependencies, 1k gzipped, ~120 SLOC
* Expressive syntax for describing transactions, [ImmerJS](https://immerjs.github.io/immer/docs/introduction) inspired, but using plain JS objects.
* Automatic individual patches recording, again [ImmerJS](https://immerjs.github.io/immer/docs/introduction) inspired, and without Proxy voodoo magic :)
* Middleware: logging, time travel, etc. out of the box
* *Extremely* simple and non-opinionated
* Directly usable in [SvelteJS](https://svelte.dev/) applications: follows Svelte's store API
* Plugin available for [VueJS](https://vuejs.org/) (so you can use it instead of, say, [VueX](https://vuex.vuejs.org/))

## Design rationale
The Redux's concept of a single immutable store is very solid and allows for lots of powerful paradigms implemented in a simple way thanks to referential equality. Unfortunately it has been traditionally associated with lots of boilerplate and noise. Actions, action creators, reducers, reducer combiners, you name it...

It does not have to be this way!

Redux tightly couples concepts of actions and reducers (mutations). Mutations may only happen as a result of actions. In the MobX / VueX world this coupling is softened, and mutations only need to happen within actions in the so-called "strict mode". The focus is still though on treating the actions as semantic units driving the state change, while the mutations are happening under the hood, in a semi-magical, hard to trace reactive fashion.

tinyX attempts to have the best of both worlds without over-engineering things

## Example
```js
import { tx } from 'tinyx';
import logger from 'tinyx/middleware/logger';

const store =
  logger(
    tx({ todos: [] })
  );

// Transaction
function ADD_TODO(task) {
  return ({ update }) => update('todos', todos => [...todos, { task }])
}

store.commit(ADD_TODO, 'Start using tinyX');
// prints
// [ADD_TODO]: Start using tinyX [ { path: [ 'todos' ], oldValue: [], newValue: [ [Object] ] } ]
```

## Design concepts
tinyX builds upon the concept of a store as a simple contract:
> A store is simply an object with `get` and `subscribe` methods that allow interested parties to read the store value and be notified whenever it changes.

Like in Redux, the store represents the root of your unique state tree. Again, like in Redux, the whole tree is immutably replaced upon every change by a reducer.
tinyX just provides an expressive and intuitive way to build the reducers from elementary operations.

You can put anything into your store: functions, promises, whatever you please, it is *your* store ! It is never *augmented* with proxies or tampered with in any way.

## Terminology
* A *mutation* is a function applying elementary operations to a *temporary* sub-state, e.g.
```js
  ({ set, update }) => {
    set('important', true);
    update('text', value => value.toUpperCase());
    set('style', 'color', 'red');
  }
```
A mutation can use 5 elementary operations, each following a `keyPath` from the root of the state tree across plain objects, arrays and ES6 maps
- `get(...keyPath)` : returns a value at `keyPath`
- `set(...keyPath, value)` : sets a value at `keyPath`
- `update(...keyPath, updater)` : updates a value at `keyPath`
- `remove(...keyPath)` : removes a value at `keyPath`
- `apply(...keyPath, mutation)` : applies another mutation at `keyPath`

Each operation replaces the whole temporary sub-state (a la [ImmutableJS](https://immutable-js.github.io/immutable-js/)), but unlike ImmutableJS they support ES6 Maps.
tinyX automatically wraps every mutation in an [ImmerJS](https://immerjs.github.io/immer/docs/introduction)-like `produce` helper to make the atomic reducer:
```js
reducer = produce(mutation)
```
which is just a function `state => newState`.

* A *transaction* is a function `payload => mutation`, e.g.
```js
function ADD_TODO(task) {
  return ({ update }) => update('todos', todos => [...todos, { task }])
}
```

Transactions may be *committed* to the tinyX store at an arbitrary location, always resulting in a synchronous atomic update of the whole tree:
```js
  store.commit(ADD_TODO, 'Start using tinyX', ...keyPath);
```
`store.commit` returns an array of individual changes in the format `[{ path, oldValue, newValue }]`

Note how the transactions are described in a concise semantic fashion with zero dependencies.

It is a good practice to create logical modules containing transactions only and nothing else, and import them as needed.
This could serve as a reference to everything that can happen to your application state, in one place.
It is also a good practice to declare transactions with the `function` keyword, so that middleware (e.g. a logger) could have access to the function name.

## Middleware
With *tinyX* there is no *middleware* in the classical sense: you don't need a special semantic concept for this. The store is a simple contract with only three methods in the interface: `Tinyx = { subscribe, get, commit }`, so if you want your transactions to travel through extra layers of processing (i.e. logging) you simply implement a transformer, e.g. `logger: (store: Tinyx) => Tinyx` and commit your transactions into transformed store.
```js
import { tx } from 'tinyx';
import logger from 'tinyx/middleware/logger';

const store = logger(tx(initialState));
store.commit(ADD_TODO, task);   // will get logged to console
```
You can `import applyMiddleware from 'tinyx/middleware'` to add syntactic sugar for this:
```js
const store = applyMiddleware(tx(initialState), [...middleware]);
```
**Note** Check out a logger and a generic undo/redo examples in the `middleware` folder.

### Using as a Svelte store
Out of the box `tinyX` is compliant to the Svelte `Readable` store contract, and thus can be directly referenced as `$store` in Svelte components.
You can also augment it with Svelte `Writable` contract traits `set` and `update` using `tinyx/middleware/writable-traits` which work by committing predefined mutations `SET(value)` and `UPDATE(updater)` using the store's `commit` function.

## Actions
Unlike Redux or VueX, tinyX is totally non-opinionated in the way it treats actions (whether user-initiated actions or asynchronous events). They become just plain Javascript functions, totally decoupled from any components. An action would usually take the store it operates on as its first argument, though it is not a strict requirement.

For instance, the `undo_redo` middleware exports two such generic actions, namely, `undo` and `redo`, as well as a generic wrapper `undoable`, which, applied to any action, makes it, well, undoable :)
Example:

```js
import { tx } from 'tinyx';
import applyMiddleware from 'tinyx/middleware';
import { undo, redo, undoable, enableUndoRedo } from 'tinyx/middleware/undo_redo';
import logger from 'tinyx/middleware/logger';

const store = applyMiddleware(tx({ todos: [] }), [enableUndoRedo, logger]);

// Export a new action
export const addTodo = undoable((store, task) => store.commit(ADD_TODO, task));

addTodo(store, 'Run 10 miles in the morning !');
undo(store);
redo(store);
```

## Sub-trees and derived stores
tinyX exports a couple of helpers `select` and `derived` sharing a similar signature `(store, selector) => subStore`.

For `select` `selector = state => keyPath`, e.g.
```js
import { tx, select } from 'tinyx';

const store = tx({
  documents: new Map(),
  activeDocumentId: null
});

const activeDocument = select(store, ({ activeDocumentId }) => ['documents', activeDocumentId]);
```

`activeDocument` will have the same API as the root store, you can commit transactions to it, and they will travel through all the middleware attached to the root store.

You can also wrap selected sub-stores in extra *middleware*, so that only transactions committed directly into it would go through the extra layer. This functional approach gives incredible flexibility to mix and match middleware and sub-trees. In a sense, `select` itself may be called a *middleware*: it is just a store transformer preserving the `Tinyx` contract.

For `derived` `selector = state => derivedState`, e.g.
```js
import { tx, derived } from 'tinyx';

const store = tx({
  documents: new Map(),
  activeDocumentId: null
});

const activeDocument = derived(store, ({ documents, activeDocumentId }) => documents.get(activeDocumentId));
```

You cannot commit transactions to derived stores (they are `Readable` only), but the `selector` does not have to represent a sub-tree: it can be any derived state.

Svelte developers would enjoy the same `$activeDocument` syntactic sugar: reading from it creates an auto-subscription that only notifies subscribers if the corresponding state is affected.

With tinyX you can now easily (and you should !!!) turn on the `immutable: true` Svelte compiler option and enjoy improved performance and strictly predictable re-renders.

## Plugins
There is a VueJS plugin in the `plugins` folder, that injects the tinyX store into all Vue components created and hooks its `.subscribe` method to the Vue reactivity system, so the components can react to transactions committed to the store.

Usage:
```js
import VueStore from 'tinyx/plugins/vue'
import Vue from 'vue'

Vue.use(VueStore, { store, name: 'tx' });
```
All components will then have the `tx()` method returning the latest state root.

More than happy to accept a PR with an equivalent of `react-redux` to use tinyX with React.
