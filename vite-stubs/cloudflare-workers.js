// Dev-only stub for the `cloudflare:workers` runtime module, which only exists
// inside workerd. `vinext dev` runs on Node, so vite.config aliases the module
// here during dev. In the Workers build the real module is used (no alias), and
// `env` exposes the configured bindings (Hyperdrive, etc.).
export const env = {};
