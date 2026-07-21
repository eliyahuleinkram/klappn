// Minimal ambient types for the Workflows runtime so this worker typechecks
// without pulling in @cloudflare/workers-types. For full types, run
// `wrangler types` in this directory and reference the generated file instead.
declare module "cloudflare:workers" {
  export const env: {
    HYPERDRIVE?: { connectionString: string };
    [key: string]: unknown;
  };

  export interface WorkflowEvent<P> {
    payload: P;
    timestamp: Date;
    instanceId: string;
  }

  export interface WorkflowStepConfig {
    retries?: { limit: number; delay: number | string; backoff?: string };
    timeout?: number | string;
  }

  export interface WorkflowStep {
    do<T>(name: string, callback: () => Promise<T> | T): Promise<T>;
    do<T>(
      name: string,
      config: WorkflowStepConfig,
      callback: () => Promise<T> | T,
    ): Promise<T>;
    sleep(name: string, duration: number | string): Promise<void>;
  }

  export abstract class WorkflowEntrypoint<Env = unknown, Payload = unknown> {
    protected env: Env;
    protected ctx: ExecutionContext;
    abstract run(
      event: WorkflowEvent<Payload>,
      step: WorkflowStep,
    ): Promise<unknown>;
  }
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
