import { getUserId } from "@/lib/session";
import { addTokenUsage, assertQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";
import { complete } from "@/lib/llm";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";
import { parseTweaks, TWEAKS_SYSTEM } from "@/lib/zaltz-assist";
import { SKETCH_CODE_MAX } from "@/lib/sketches";

export const dynamic = "force-dynamic";

/**
 * TWEAK CHIPS — after a loop RUNS CLEAN, the machine offers 3-5 one-tap next
 * moves; tapping one fires the normal Ask path (Opus, proposal, accept/bin).
 * This call only NAMES the moves, so it rides the same fast lane as the
 * copilot: Sonnet 5, thinking off, JSON out. Client throttles to one call per
 * clean run (min 45s apart); the IP gate backstops it.
 */
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) {
    return Response.json(
      { error: "session required", code: "session_required" },
      { status: 401 },
    );
  }
  if (!(await rateLimit(`tweaks:ip:${clientIp(req)}`, 6, 300))) return tooMany();

  const body = (await req.json().catch(() => null)) as {
    strudel?: unknown;
    hydra?: unknown;
  } | null;
  const strudel =
    typeof body?.strudel === "string" ? body.strudel.slice(0, SKETCH_CODE_MAX) : "";
  const hydra =
    typeof body?.hydra === "string" ? body.hydra.slice(0, SKETCH_CODE_MAX) : "";
  if (!strudel.trim() && !hydra.trim()) return Response.json({ tweaks: [] });

  const gate = await assertQuota(userId);
  if (gate) return gate;

  const sink = makeCallSink();
  try {
    const raw = await complete(
      TWEAKS_SYSTEM,
      `STRUDEL PANE:
${strudel}

HYDRA PANE:
${hydra.trim() ? hydra : "(empty)"}`,
      {
        model: "sonnet",
        onUsage: (t: number) => void addTokenUsage(userId, t),
        onCall: sink.onCall,
      },
      {
        thinking: false,
        maxTokens: 600,
        trace: { kind: "ide-tweaks" },
      },
    );
    return Response.json({ tweaks: parseTweaks(raw) });
  } catch (e) {
    console.error("[klappn] tweaks failed:", e);
    return Response.json({ tweaks: [] }); // chips just don't appear
  } finally {
    await sink.flush();
  }
}
