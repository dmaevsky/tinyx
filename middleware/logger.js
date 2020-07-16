const txLogger = ({ commit, ...rest }) => ({
  commit: (transaction, payload, ...keyPath) => {
    const changes = commit(transaction, payload, ...keyPath);

    let msg = keyPath.length ? keyPath.join('.') + ' [' : '[';
    msg += transaction.name + ']';
    if (transaction.length) console.log(msg + ':', payload, changes);
    else console.log(msg, changes);

    return changes;
  },
  ...rest
});

export default txLogger;
