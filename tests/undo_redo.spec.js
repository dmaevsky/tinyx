import test from 'node:test';
import assert from 'node:assert/strict';

import { tx } from '../tx.js';
import { enableUndoRedo, undoable, undo, redo } from '../middleware/undo_redo/index.js';

test('undo/redo', () => {
  const store =
    enableUndoRedo(
      tx({ todos: [] })
    );

  // Transaction
  function ADD_TODO(task) {
    return ({ update }) => update('todos', todos => [...todos, { task }])
  }

  // Action
  const addTodo = undoable((store, todo) => store.commit(ADD_TODO, todo));

  addTodo(store, 'Start using tinyX');

  assert.deepEqual(store.get(), {
    todos: [{ task: 'Start using tinyX' }],
    history: [[{ path: ['todos'], newValue: [{ task: 'Start using tinyX' }], oldValue: [] }]],
    future: [],
  });

  undo(store);

  assert.deepEqual(store.get(), {
    todos: [],
    history: [],
    future: [[{ path: ['todos'], newValue: [{ task: 'Start using tinyX' }], oldValue: [] }]],
  });

  redo(store);

  assert.deepEqual(store.get(), {
    todos: [{ task: 'Start using tinyX' }],
    history: [[{ path: ['todos'], newValue: [{ task: 'Start using tinyX' }], oldValue: [] }]],
    future: [],
  });

});
