export default {
  install(Vue, { store, name }) {
    const cleanupProp = name + 'Unsubscribe';
    const stateProp = name + 'State';

    Vue.mixin({
      data: function () { return {
        [stateProp]: null,
        [cleanupProp]: null
      }},

      methods: {
        [name]: function() {
          if (!this[cleanupProp]) {
            this[cleanupProp] = store.subscribe(s => this[stateProp] = s);
          }
          return this[stateProp];
        }
      },

      beforeDestroy: function() {
        const cleanup = this[cleanupProp];
        if (cleanup) cleanup();
      }
    });
  }
}
