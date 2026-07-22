import {
  applyPartEdit,
  convertSongMeter,
  editLoopDirect,
  generateOnePart,
  runEdit,
} from "./jobs";
import type { ModelId } from "./models";

/**
 * Triggering background work, framework-neutral.
 *
 * In production the actual durable Workflows live in a SEPARATE Cloudflare
 * Worker (see /workflows). We can't reach a Workers binding from standard
 * Next.js route code without a vinext-specific context API, so instead we
 * create instances through the Cloudflare Workflows REST API using plain
 * `fetch` + env vars — which works from any runtime.
 *
 * In local dev (no Cloudflare creds) we fall back to running the same job core
 * in-process, fire-and-forget, so the full create -> generate -> poll loop is
 * testable end-to-end without deploying anything. This path is NOT durable and
 * is dev-only.
 */

interface CfConfig {
  accountId: string;
  apiToken: string;
}

function cfConfig(): CfConfig | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (accountId && apiToken) return { accountId, apiToken };
  return null;
}

async function createInstance(
  workflowName: string,
  params: Record<string, unknown>,
): Promise<string> {
  const cf = cfConfig();
  if (!cf) {
    throw new Error("Cloudflare config missing");
  }
  // ONE retry on a transient control-plane failure (timeout / 5xx / 429): a
  // single hiccup here used to strand the just-inserted part — the kick-off
  // failed, nothing composed, and the card sat "loading" forever (seen live
  // 2026-07-22). A hard 4xx (bad token, bad params) still fails immediately.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 800));
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/workflows/${workflowName}/instances`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cf.apiToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ params }),
          // A hung control-plane call must FAIL (the routes walk their status flip
          // back and tell the user) rather than hold the request open.
          signal: AbortSignal.timeout(15_000),
        },
      );
      const json = (await res.json()) as {
        success: boolean;
        result?: { id: string };
        errors?: unknown;
      };
      if (!res.ok || !json.success || !json.result?.id) {
        const err = new Error(
          `Workflows API error (${res.status}): ${JSON.stringify(json.errors ?? json)}`,
        );
        if (res.status >= 500 || res.status === 429) {
          lastErr = err;
          continue; // transient → one more try
        }
        throw err;
      }
      return json.result.id;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Workflows API error")) throw e;
      lastErr = e; // timeout / network — retry once
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

const GENERATION_WORKFLOW =
  process.env.GENERATION_WORKFLOW_NAME || "klappn-generation";
const EDIT_WORKFLOW = process.env.EDIT_WORKFLOW_NAME || "klappn-edit";

/** Kick off generation for one part — or an ORDERED LIST of parts composed
 *  sequentially in the given order (e.g. a new loop, THEN the bridge that
 *  depends on it). Returns an instance id to store on the song. */
export async function triggerGeneration(
  songId: string,
  partId?: string | string[],
  provider?: ModelId,
): Promise<string> {
  const ids = Array.isArray(partId) ? partId : partId ? [partId] : [];
  if (cfConfig()) {
    return createInstance(GENERATION_WORKFLOW, {
      songId,
      ...(ids.length === 1 ? { partId: ids[0] } : {}),
      ...(ids.length > 1 ? { partIds: ids } : {}),
      ...(provider ? { provider } : {}),
    });
  }
  // dev fallback (no Cloudflare): run the same job core in-process, in order.
  // Single model now — no provider config to thread.
  const cfg = undefined;
  if (ids.length === 0) {
    console.error(`[klappn] dev generation: no partId for ${songId}`);
    return `dev-gen-${songId}`;
  }
  void (async () => {
    for (const id of ids) await generateOnePart(songId, id, undefined, cfg);
  })().catch((e) =>
    console.error(`[klappn] dev generation failed for ${songId}:`, e),
  );
  return `dev-gen-${songId}`;
}

/** Kick off an edit; returns an instance id. */
export async function triggerEdit(
  songId: string,
  changeRequest: string,
): Promise<string> {
  if (cfConfig()) {
    return createInstance(EDIT_WORKFLOW, { songId, changeRequest });
  }
  // dev fallback
  void runEdit(songId, changeRequest).catch((e) =>
    console.error(`[klappn] dev edit failed for ${songId}:`, e),
  );
  return `dev-edit-${songId}`;
}

/** Kick off a TIME-SIGNATURE change — every loop rewritten in sequence;
 *  returns an instance id. */
export async function triggerMeterChange(
  songId: string,
  timeSignature: string,
): Promise<string> {
  if (cfConfig()) {
    return createInstance(EDIT_WORKFLOW, { songId, timeSignature });
  }
  // dev fallback
  void convertSongMeter(songId, timeSignature).catch((e) =>
    console.error(`[klappn] dev meter change failed for ${songId}:`, e),
  );
  return `dev-meter-${songId}`;
}

/** Kick off a one-tap VARIANT edit on a single loop (an edit pill); returns an
 *  instance id. */
export async function triggerPartEdit(
  songId: string,
  partId: string,
  pill: string,
): Promise<string> {
  if (cfConfig()) {
    return createInstance(EDIT_WORKFLOW, { songId, partId, pill });
  }
  // dev fallback
  void applyPartEdit(songId, partId, pill).catch((e) =>
    console.error(`[klappn] dev variant failed for ${partId}:`, e),
  );
  return `dev-variant-${partId}`;
}

/** Kick off a NATURAL-LANGUAGE edit on a single loop ("drop the pad and add a shaker") — the router splits
 *  it into ordered ops and the executor applies them to that loop, song-aware. May be several model calls
 *  (a batch can include an add), so it runs in the EditWorkflow; dev runs it in-process. Returns an id. */
export async function triggerLoopEdit(
  songId: string,
  partId: string,
  request: string,
): Promise<string> {
  if (cfConfig()) {
    return createInstance(EDIT_WORKFLOW, { songId, partId, editRequest: request });
  }
  // dev fallback
  void editLoopDirect(songId, partId, request).catch((e) =>
    console.error(`[klappn] dev loop-edit failed for ${partId}:`, e),
  );
  return `dev-loopedit-${partId}`;
}

/**
 * Terminate a running Workflow instance — stops ALL its steps and any in-flight
 * model call immediately. This is the exact REST call `wrangler workflows
 * instances terminate` makes: PATCH the instance status to "terminate". Best-
 * effort and never throws, so deleting/cancelling a song is never blocked if the
 * instance already finished, was a local-dev placeholder, or the API hiccups.
 */
async function terminateInstance(
  workflowName: string,
  instanceId: string,
): Promise<boolean> {
  const cf = cfConfig();
  // No creds (local dev) or a dev placeholder id (`dev-gen-…`) → nothing to stop.
  if (!cf || !instanceId || instanceId.startsWith("dev-")) return false;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/workflows/${workflowName}/instances/${instanceId}/status`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${cf.apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ status: "terminate" }),
        signal: AbortSignal.timeout(10_000), // best-effort — never blocks a delete
      },
    );
    return res.ok;
  } catch (err) {
    console.error(`[klappn] terminate ${instanceId} failed:`, err);
    return false;
  }
}

/**
 * Stop a song's generation Workflow if one is running — so deleting (or
 * cancelling) a song also halts the model calls it has in flight. Best-effort:
 * pass the song's stored `generation_workflow_id`.
 */
export async function terminateGeneration(
  instanceId: string | null | undefined,
): Promise<void> {
  if (instanceId) await terminateInstance(GENERATION_WORKFLOW, instanceId);
}

/**
 * Terminate MANY generation workflows (bulk delete) with BOUNDED concurrency —
 * best-effort, never throws. Null / finished / `dev-` ids are dropped for free,
 * so in practice only the handful still composing hit the Cloudflare API. The
 * cap stops a big batch from fanning out hundreds of terminate calls at once
 * (which the API would rate-limit).
 */
export async function terminateManyGenerations(
  instanceIds: (string | null | undefined)[],
  concurrency = 6,
): Promise<void> {
  const live = instanceIds.filter(
    (id): id is string =>
      typeof id === "string" && id !== "" && !id.startsWith("dev-"),
  );
  let next = 0;
  const worker = async () => {
    while (next < live.length) {
      await terminateInstance(GENERATION_WORKFLOW, live[next++]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, live.length) }, worker),
  );
}
