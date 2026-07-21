// Ambient types for the workerd `cloudflare:workers` runtime module, so the app
// typechecks without @cloudflare/workers-types. We only read `env.HYPERDRIVE`.
declare module "cloudflare:workers" {
  export const env: {
    HYPERDRIVE?: { connectionString: string };
    [key: string]: unknown;
  };
}
