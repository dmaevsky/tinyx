const txLogger = next => {
  return (keyPath, transaction, payload) => {
    const changes = next(keyPath, transaction, payload);

    let msg = keyPath.length ? keyPath.join('.') + ' [' : '[';
    msg += transaction.name + ']';
    if (transaction.length) console.log(msg + ':', payload, changes);
    else console.log(msg, changes);

    return changes;
  };
}

export default txLogger;
