const getIn = (o, ...keyPath) => {
  if (!o) return undefined;
  if (!keyPath.length) return o;
  let [key, ...path] = keyPath;
  return getIn(o instanceof Map ? o.get(key) : o[key], ...path);
}

const setIn = (o, ...keyPath) => {
  let value = keyPath.pop();
  if (!keyPath.length) return value;
  let [key, ...path] = keyPath;

  if (o instanceof Map) return new Map(o).set(key, setIn(o.get(key), ...path, value));
  return Object.assign(o instanceof Array ? [] : {}, o, { [key]: setIn(o && o[key], ...path, value) });
}

const updateIn = (o, ...keyPath) => {
  let updater = keyPath.pop();
  let oldValue = getIn(o, ...keyPath), newValue = updater(oldValue);
  return oldValue === newValue ? o : setIn(o, ...keyPath, newValue);
}

const deleteIn = (o, key, ...path) => {
  if (!o || typeof o !== 'object') return o;
  if (!path.length) {
    if (o instanceof Map) (o = new Map(o)).delete(key);
    else if (o instanceof Set) (o = new Set(o)).delete(key);
    else delete (o = (o instanceof Array ? [...o] : {...o}))[key];
    return o;
  }
  return setIn(o, key, deleteIn(getIn(o, key), ...path));
}

const prepend = (push, prefixPath) => push && (({ path, ...rest }) => push({ path: [...prefixPath, ...path], ...rest }));

const produce = (mutation, record) => state => {
  const ops = {
    get: (...path) => getIn(state, ...path),
    set: (...path) => {
      let newValue = path.pop();

      if (record) record({ path, oldValue: getIn(state, ...path), newValue });
      return state = setIn(state, ...path, newValue);
    },
    update: (...path) => {
      let updater = path.pop();
      let oldValue = getIn(state, ...path);
      let newValue = updater(oldValue);
      if (newValue === oldValue) return state;

      if (record) record({ path, oldValue, newValue });
      return state = setIn(state, ...path, newValue);
    },
    remove: (...path) => {
      if (record) record({ path, oldValue: getIn(state, ...path) });
      return state = deleteIn(state, ...path);
    },
    apply: (...path) => {
      let innerMutation = path.pop();
      return state = updateIn(state, ...path, produce(innerMutation, prepend(record, path)));
    }
  }
  if (mutation) mutation(ops);
  return state;
}

const tx = ({ update, ...rest }, middleware = []) => {
  let commit = (keyPath, transaction, payload) => {
    let changes = [];
    update(s => updateIn(s, ...keyPath, produce(transaction(payload), prepend(r => changes.push(r), keyPath))));
    return changes;
  }

  for (let mw of middleware.slice().reverse()) commit = mw(commit);

  return {
    update, ...rest,
    get: (...keyPath) => { let state;  update(s => state = s);  return getIn(state, ...keyPath); },
    commit: (...keyPath) => {
      let payload, transaction = keyPath.pop();
      if (typeof transaction !== 'function') [payload, transaction] = [transaction, keyPath.pop()];
      return commit(keyPath, transaction, payload);
    }
  }
}

function SET_VALUE(value) { return ({ set }) => set(value); }
function UPDATE_VALUE(updater) { return ({ update }) => update(updater); }

const select = ({ subscribe, get, commit }, selector) => {
  if (typeof selector !== 'function') selector = () => selector;
  return {
    subscribe: subscriber => {
      let selected;
      return subscribe(state => {
        const nowSelected = getIn(state, ...selector(state));
        if (nowSelected !== selected) subscriber(selected = nowSelected);
      });
    },
    get: (...keyPath) => get(...selector(get()), ...keyPath),
    set: value => commit(...selector(get()), SET_VALUE, value),
    update: updater => commit(...selector(get()), UPDATE_VALUE, updater),
    commit: (...keyPath) => commit(...selector(get()), ...keyPath)
  }
}

module.exports = { getIn, setIn, updateIn, deleteIn, produce, tx, select }
