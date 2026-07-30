import { getUserId } from "@/lib/session";
import { addTokenUsage, assertQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";
import { complete, ROUTE } from "@/lib/llm";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";
import {
  EXPLAIN_HYDRA_SYSTEM,
  EXPLAIN_STRUDEL_SYSTEM,
  explainUserText,
} from "@/lib/zaltz-assist";

export const dynamic = "force-dynamic";

/**
 * ✦ EXPLAIN — select a fragment, learn the language (2026-07-28, user:
 * "people who want to understand the actual code itself so they can learn to
 * write it themselves"). Strictly ON-DEMAND — nothing is explained ahead of
 * time (tokens burned on lines nobody asked about), and ROUTE.explain — SONNET 5
 * no-thinking (user's call: "I do not believe we will need something stronger")
 * — a short teaching answer, not composition.
 */
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) {
    return Response.json(
      { error: "session required", code: "session_required" },
      { status: 401 },
    );
  }
  if (!(await rateLimit(`explain:ip:${clientIp(req)}`, 20, 60))) return tooMany();

  const body = (await req.json().catch(() => null)) as {
    pane?: unknown;
    code?: unknown;
    sel?: unknown;
  } | null;
  const pane = body?.pane === "hydra" ? "hydra" : "strudel";
  const code = typeof body?.code === "string" ? body.code.slice(0, 8000) : "";
  const sel = typeof body?.sel === "string" ? body.sel.slice(0, 2000) : "";
  if (!sel.trim()) return Response.json({ text: "" });

  const gate = await assertQuota(userId);
  if (gate) return gate;

  const sink = makeCallSink();
  try {
    const text = (
      await complete(
        pane === "hydra" ? EXPLAIN_HYDRA_SYSTEM : EXPLAIN_STRUDEL_SYSTEM,
        explainUserText(code, sel),
        {
          onUsage: (t: number) => void addTokenUsage(userId, t),
          onCall: sink.onCall,
        },
        { ...ROUTE.explain, trace: { kind: "ide-explain" } },
      )
    )
      .replace(/^\s*```[a-z]*\r?\n?/i, "")
      .replace(/\r?\n?```\s*$/i, "")
      .trim();
    // Prose, not code — the seal law covers code-bearing payloads; a teaching
    // sentence about the coder's own selection travels plain.
    return Response.json({ text });
  } catch (e) {
    console.error("[klappn] explain failed:", e);
    return Response.json({ text: "" });
  } finally {
    await sink.flush();
  }
}
