import { getUserId } from "@/lib/session";
import { addTokenUsage, assertQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";
import { complete } from "@/lib/llm";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";
import { NAMES_SYSTEM, parseNames } from "@/lib/zaltz-assist";
import { SKETCH_CODE_MAX } from "@/lib/sketches";

export const dynamic = "force-dynamic";

/**
 * THE NAMER — after a loop runs clean, every `$:` line gets a human name so
 * the dials read like a desk ("Deep kick", "Shimmer hats"), not a stack
 * trace. Sonnet 5, thinking off, JSON out — naming is cheap and the client
 * throttles to one call per clean run. (This endpoint replaced /api/tweaks
 * when the chips were cut, 2026-07-26: the dials ARE the tweaks now.)
 */
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) {
    return Response.json(
      { error: "session required", code: "session_required" },
      { status: 401 },
    );
  }
  if (!(await rateLimit(`names:ip:${clientIp(req)}`, 6, 300))) return tooMany();

  const body = (await req.json().catch(() => null)) as { strudel?: unknown } | null;
  const strudel =
    typeof body?.strudel === "string" ? body.strudel.slice(0, SKETCH_CODE_MAX) : "";
  if (!strudel.trim()) return Response.json({ layerNames: [] });

  const gate = await assertQuota(userId);
  if (gate) return gate;

  const sink = makeCallSink();
  try {
    const raw = await complete(NAMES_SYSTEM, strudel, {
      model: "sonnet",
      onUsage: (t: number) => void addTokenUsage(userId, t),
      onCall: sink.onCall,
    }, {
      thinking: false,
      maxTokens: 500,
      trace: { kind: "ide-names" },
    });
    return Response.json({ layerNames: parseNames(raw) });
  } catch (e) {
    console.error("[klappn] names failed:", e);
    return Response.json({ layerNames: [] }); // sniffed labels carry on
  } finally {
    await sink.flush();
  }
}
