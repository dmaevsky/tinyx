export function UNDOABLE_ACTION_START() {
  return ({ set }) => set('future', []);
}

export function UNDOABLE_ACTION_END(changes) {
  return ({ update }) => update('history', history => [changes, ...history]);
}

export function UNDO() {
  return ({ get, set, update, remove }) => {
    const changes = get('history', 0);
    if (!changes) return;

    for (let { path, oldValue } of changes.slice().reverse()) {
      if (oldValue === undefined) remove(...path);
      else set(...path, oldValue);
    }

    update('future', future => [changes, ...future]);
    update('history', history => history.slice(1));
  }
}

export function REDO() {
  return ({ get, set, update, remove }) => {
    const changes = get('future', 0);
    if (!changes) return;

    for (let { path, newValue } of changes) {
      if (newValue === undefined) remove(...path);
      else set(...path, newValue);
    }

    update('history', history => [changes, ...history]);
    update('future', future => future.slice(1));
  }
}
