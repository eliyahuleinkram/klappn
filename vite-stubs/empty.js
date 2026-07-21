// Stub for optional native deps (e.g. pg-native) that we never use. `pg` only
// requires pg-native when you opt into native mode, which we don't, but the
// bundler still tries to resolve the import — point it here instead.
export default {};
