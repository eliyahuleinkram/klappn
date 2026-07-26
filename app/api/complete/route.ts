import { getUserId } from "@/lib/session";
import { addTokenUsage, assertQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";
import { complete } from "@/lib/llm";
import { sealDeep } from "@/lib/seal";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";
import {
  cleanCompletion,
  COMPLETE_HYDRA_SYSTEM,
  COMPLETE_STRUDEL_SYSTEM,
} from "@/lib/zaltz-assist";

export const dynamic = "force-dynamic";

/**
 * THE COPILOT'S FAST LANE — one small ghost-text completion at the caret.
 * Sonnet 5 with thinking DISABLED (latency is the product here; the Ask path
 * keeps Opus for the big takes) and a tight output cap. Throttled twice: the
 * client debounces the caret, and this per-IP gate stops a runaway loop.
 *
 * Quota: assertQuota (the cheap pre-flight), not a reservation — a completion
 * is ~1-2k weighted units and the rate limit bounds parallel abuse; holding a
 * 30k reservation per keystroke would thrash the ledger for nothing. Spend is
 * metered for real via addTokenUsage, trajectories captured like every call.
 */
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) {
    return Response.json(
      { error: "session required", code: "session_required" },
      { status: 401 },
    );
  }
  if (!(await rateLimit(`complete:ip:${clientIp(req)}`, 30, 60))) return tooMany();

  const body = (await req.json().catch(() => null)) as {
    pane?: unknown;
    before?: unknown;
    after?: unknown;
  } | null;
  const pane = body?.pane === "hydra" ? "hydra" : "strudel";
  const before = typeof body?.before === "string" ? body.before.slice(-6000) : "";
  const after = typeof body?.after === "string" ? body.after.slice(0, 2000) : "";
  if (!before.trim()) return Response.json({ ghost: "" });

  const gate = await assertQuota(userId);
  if (gate) return gate;

  const sink = makeCallSink();
  try {
    const raw = await complete(
      pane === "hydra" ? COMPLETE_HYDRA_SYSTEM : COMPLETE_STRUDEL_SYSTEM,
      `BEFORE (cursor at the end of this):
${before}
AFTER:
${after || "(end of file)"}`,
      {
        model: "sonnet",
        onUsage: (t: number) => void addTokenUsage(userId, t),
        onCall: sink.onCall,
      },
      {
        thinking: false,
        maxTokens: 400,
        trace: { kind: "ide-complete" },
      },
    );
    return Response.json(sealDeep({ ghost: cleanCompletion(raw, before) }));
  } catch (e) {
    console.error("[klappn] complete failed:", e);
    return Response.json({ ghost: "" }); // a missing ghost is not an error state
  } finally {
    await sink.flush();
  }
}
