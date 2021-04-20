export function SET(value) {
  return ({ set }) => set(value);
}

export function UPDATE(updater) {
  return ({ update }) => update(updater);
}

export default ({ commit, ...rest }) => ({
  set: value => Boolean(commit(SET, value).length),
  update: updater => Boolean(commit(UPDATE, updater).length),
  commit,
  ...rest
});
