export default applyMiddleware = (store, middleware = []) => {
  return middleware.reduceRight((acc, mw) => mw(acc), store);
}
