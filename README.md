# tinyX
A tiny state manager for big applications

## Why tinyX ?
* [Redux](https://redux.js.org/) inspired
* No boilerplate
* Zero dependencies, 1k gzipped, ~100 SLOC
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

## Design concepts
tinyX builds upon the concept of a store as a simple contract, as it is popularized in SvelteJS, but it does not have any direct dependencies on Svelte.

From Svelte API docs:
> A store is simply an object with a `subscribe` method that allows interested parties to be notified whenever the store value changes.
> A writable store has `set` and `update` methods in addition to `subscribe`.

Thus, in Svelte applications it would be natural to use [`svelte/store/writable`](https://svelte.dev/docs) as the base for the single store root.

```js
import { writable } from 'svelte/store';
import { tx } from 'tinyx';

const store = tx(writable({ todos: [] }));
```

You can create your own stores without relying on `svelte/store`, by implementing the writable store contract:
```js
store = { subscribe: (subscription: (value: any) => void) => () => void, set: (value: any) => void }
```

Like in Redux, the store represents the root of your unique state tree. Again, like in Redux, the whole tree is immutably replaced upon every change by a reducer.
tinyX just provides an expressive and intuitive way to build the reducers from elementary operations i.e. `{ set, update, remove }`

You can put anything into your store: functions, promises, whatever you please, it is *your* store ! It is never *augmented* with proxies or tampered with in any way.

## Terminology
* A *mutation* is a function applying elementary operations to a *temporary* sub-state, e.g.
```js
  ({set, update}) => set('important', true) && update('value' => value.toUpperCase()) && set('style', 'color', 'red')
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
  store.commit(...keyPath, ADD_TODO, 'Start using tinyX');
```
`store.commit` returns an array of individual changes in the format `[{ keyPath, oldValue, newValue }]`

Note how the transactions are described in a concise semantic fashion with zero dependencies.

It is a good practice to create logical modules containing transactions only and nothing else, and import them as needed.
This could serve as a reference to everything that can happen to your application state, in one place.
It is also a good practice to declare transactions with the `function` keyword, so that middleware (e.g. a logger) could have access to the function name.

## Middleware
`tx` takes a second argument, which is a list of middleware: functions with a classical middleware signature
```js
next => (keyPath, transaction, payload) => changes
```
a function taking the inner layer `.commit` function (`next`) as an argument and returning a new `.commit`, wrapped with the middleware functionality. It is important to return the array of changes from the middleware, so that it could be propagated to the outer layer. Example:
```js
const miniLogger = next => (keyPath, transaction, payload) => (console.log(transaction.name)), next(keyPath, transaction, payload))
```

tinyX applies the middleware in the order it is specified.

**Note** that each middleware can analyse the transaction name and the payload before applying the inner `next` layer (possibly skipping it altogether), as well read and possibly modify the changes returned by it, before returning them to the outer layer. Check out a logger and a generic undo/redo examples in the `middleware` folder.

## Actions
Unlike Redux or VueX, tinyX is totally non-opinionated in the way it treats actions (be it user-initiated actions or asynchronous events). A global store can be imported anywhere in your application, and the actions become just plain Javascript functions, totally decoupled from any components.

For instance, the `undo_redo` middleware exports two such generic actions, namely, `undo` and `redo`, as well as a generic wrapper `undoable`, which, applied to any action, makes it, well, undoable :)
Example:

```js
import { writable } from 'svelte/store';
import { tx } from 'tinyx';
import { undo, redo, undoable, enableUndoRedo } from 'tinyx/middleware/undo_redo'
import logger from 'tinyx/middleware/logger'

const store = tx(writable({ todos: [] }), [enableUndoRedo, logger]);

// Export a new action
export const addTodo = undoable(store, task => store.commit(ADD_TODO, task));

addTodo('Run 10 miles in the morning !');
undo(store);
redo(store);
```
**Note**: The `store` argument to `undoable`, `undo` and `redo` specifies which sub-store (see next section) to use to store the history.

## Sub-trees
tinyX exports a helper `select = (store, selector) => subStore`, where `selector = state => keyPath`, e.g.
```js
import { tx, select } from 'tinyx';

const store = tx(writable({
  documents: new Map(),
  activeDocumentId: null
}));

const activeDocument = select(store, ({ activeDocumentId }) => ['documents', activeDocumentId]);
```

`activeDocument` will have the same API as the root store, you can commit transactions to it, and they will travel through all the middleware attached to the root store.

Svelte developers would enjoy the same `$activeDocument` syntactic sugar: reading from it creates an auto-subscription that only notifies subscribers if the corresponding sub-tree is affected, and writing to it commits a pre-defined SET_VALUE transaction that will travel through all the middleware, attached to the root store (e.g. get logged, become undoable etc.)

With tinyX you can now easily (and there is no reason you should not !!!) turn on the `immutable: true` Svelte compiler option and enjoy improved performance and strictly predictable re-renders.

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
