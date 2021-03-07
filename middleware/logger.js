export const logger = (print = console.log) => ({ commit, ...rest }) => ({
  commit: (transaction, payload, ...keyPath) => {
    const changes = commit(transaction, payload, ...keyPath);

    let msg = keyPath.length ? keyPath.join('.') + ' [' : '[';
    msg += transaction.name + ']';
    if (transaction.length) print(msg + ':', payload, changes);
    else print(msg, changes);

    return changes;
  },
  ...rest
});

export default logger();
