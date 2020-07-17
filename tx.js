const frozen = () => { throw new TypeError('Object is frozen'); }

export const deepFreeze = o => {
  if (typeof o !== 'object' || !o || Object.isFrozen(o)) return o;
  if (![Object, Map, Set].some(C => C.prototype === Object.getPrototypeOf(o))) return o;

  if (o instanceof Map || o instanceof Set) {
    for (let method of ['add', 'set', 'clear', 'delete']) Object.defineProperty(o, method, { value: frozen });
    [...Object.freeze(o)].forEach(deepFreeze);
  }
  else Object.keys(Object.freeze(o)).forEach(key => deepFreeze(o[key]));
  return o;
}

export const getIn = (o, ...keyPath) => {
  if (!keyPath.length) return o;
  if (o === null || o === undefined) return undefined;
  let [key, ...path] = keyPath;
  return getIn(o instanceof Map ? o.get(key) : o[key], ...path);
}

export const setIn = (o, ...keyPath) => {
  let value = keyPath.pop();
  if (!keyPath.length) return deepFreeze(value);
  let [key, ...path] = keyPath;

  if (o instanceof Map) return deepFreeze(new Map(o).set(key, setIn(o.get(key), ...path, value)));
  return deepFreeze(Object.assign(o instanceof Array ? [] : {}, o, { [key]: setIn(o && o[key], ...path, value) }));
}

export const updateIn = (o, ...keyPath) => {
  let updater = keyPath.pop();
  let oldValue = getIn(o, ...keyPath), newValue = updater(oldValue);
  return oldValue === newValue ? o : setIn(o, ...keyPath, newValue);
}

export const deleteIn = (o, key, ...path) => {
  if (!o || typeof o !== 'object') return o;
  if (!path.length) {
    if (o instanceof Map) (o = new Map(o)).delete(key);
    else if (o instanceof Set) (o = new Set(o)).delete(key);
    else delete (o = (o instanceof Array ? [...o] : {...o}))[key];
    return deepFreeze(o);
  }
  return setIn(o, key, deleteIn(getIn(o, key), ...path));
}

const prepend = (push, prefixPath) => push && (({ path, ...rest }) => push({ path: [...prefixPath, ...path], ...rest }));

export const produce = (mutation, record) => state => {
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
  };
  if (mutation) mutation(ops);
  return state;
}

export const tx = ({ update, subscribe }) => {
  update(state => deepFreeze(state));
  let state;
  subscribe(s => state = s);

  return {
    subscribe,
    get: (...keyPath) => getIn(state, ...keyPath),
    commit: (transaction, payload, ...keyPath) => {
      let changes = [];
      update(s => updateIn(s, ...keyPath, produce(transaction(payload), prepend(r => changes.push(r), keyPath))));
      return changes;
    }
  };
}

export const select = ({ subscribe, get, commit }, selector) => {
  return {
    subscribe: subscriber => {
      let selected;
      return subscribe(state => {
        const nowSelected = getIn(state, ...selector(state));
        if (nowSelected !== selected) subscriber(selected = nowSelected);
      });
    },
    get: (...keyPath) => get(...selector(get()), ...keyPath),
    commit: (transaction, payload, ...keyPath) => {
      const root = selector(get());
      return commit(transaction, payload, ...root, ...keyPath)
        .map(({ path, ...rest }) => ({ path: path.slice(root.length), ...rest }));
    }
  };
}

export const derived = ({ subscribe, get }, selector, equals = (a, b) => a === b) => {
  return {
    subscribe: subscriber => {
      let selected;
      return subscribe(state => {
        const nowSelected = selector(state);
        if (!equals(nowSelected, selected)) subscriber(selected = nowSelected);
      });
    },
    get: (...keyPath) => getIn(selector(get()), ...keyPath)
  };
}
