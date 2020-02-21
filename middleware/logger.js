const txLogger = next => {
  if (process.env.NODE_ENV !== 'development') return next;

  return (keyPath, transaction, payload) => {
    let msg = keyPath.length ? keyPath.join('.') + ' [' : '[';
    msg += transaction.name + ']';
    if (transaction.length) console.log(msg + ':', payload);
    else console.log(msg);

    return next(keyPath, transaction, payload);
  };
}

export default txLogger;
