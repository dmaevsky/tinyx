import {
  UNDOABLE_ACTION_START,
  UNDOABLE_ACTION_END,
  UNDO,
  REDO
} from './mutations.js';

export const enableUndoRedo = ({ commit, ...rest }) => {
  let recording = null;

  return {
    commit: (transaction, payload, ...keyPath) => {

      if (transaction === UNDOABLE_ACTION_END) {
        if (recording && --recording.depth > 0) return [];

        payload = recording && recording.changes || [];
        recording = null;
      }

      if (transaction === UNDOABLE_ACTION_START && recording) {
        recording.depth++;
        return [];
      }

      const changes = commit(transaction, payload, ...keyPath);

      if (recording) {
        for (let { path, ...rest } of changes) {
          if (recording.path.every((p, i) => path[i] === p)) {
            recording.changes.push({ path: path.slice(recording.path.length), ...rest });
          }
        }
      }

      if (transaction === UNDOABLE_ACTION_START) {
        recording = { path: keyPath, changes: [], depth: 1 }
      }
      return changes;
    },
    ...rest
  };
};

export const undoable = (action) => (store, ...args) => {
  store.commit(UNDOABLE_ACTION_START)
  action(store, ...args);
  store.commit(UNDOABLE_ACTION_END);
};

export const undo = store => store.commit(UNDO);
export const redo = store => store.commit(REDO);
