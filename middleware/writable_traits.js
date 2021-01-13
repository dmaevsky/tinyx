export function SET(value) {
  return ({ set }) => set(value);
}

export function UPDATE(updater) {
  return ({ update }) => update(updater);
}

export default ({ commit, ...rest }) => ({
  set: value => commit(SET, value),
  update: updater => commit(UPDATE, updater),
  commit,
  ...rest
});
