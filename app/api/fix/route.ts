import { getUserId } from "@/lib/session";
import { addTokenUsage, assertQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";
import { complete, ROUTE } from "@/lib/llm";
import { sealDeep } from "@/lib/seal";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";
import { hydraServerErrors } from "@/lib/hydra-eval";
import { FIX_HYDRA_SYSTEM, FIX_STRUDEL_SYSTEM, fixUserText } from "@/lib/zaltz-assist";

export const dynamic = "force-dynamic";

/**
 * THE ONE-TAP FIX — the error chip's ✦ (2026-07-26, user: "press it and the
 * AI just fixes it, no thinking"). The broken pane + its error in, the mended
 * whole pane out. ROUTE.fix — Opus 5 thinking-DISABLED (a fix is surgery, not
 * composition), gated like the ghost: the mend may not ADD errors the pane
 * didn't have, and an unchanged or empty answer returns "" — the client tells
 * the truth instead of swapping in nothing.
 */
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) {
    return Response.json(
      { error: "session required", code: "session_required" },
      { status: 401 },
    );
  }
  if (!(await rateLimit(`fix:ip:${clientIp(req)}`, 10, 60))) return tooMany();

  const body = (await req.json().catch(() => null)) as {
    pane?: unknown;
    code?: unknown;
    error?: unknown;
  } | null;
  const pane = body?.pane === "hydra" ? "hydra" : "strudel";
  const code = typeof body?.code === "string" ? body.code.slice(0, 8000) : "";
  const error = typeof body?.error === "string" ? body.error.slice(0, 600) : "";
  if (!code.trim() || !error.trim()) return Response.json({ code: "" });

  const gate = await assertQuota(userId);
  if (gate) return gate;

  const sink = makeCallSink();
  try {
    const raw = await complete(
      pane === "hydra" ? FIX_HYDRA_SYSTEM : FIX_STRUDEL_SYSTEM,
      fixUserText(code, error),
      {
        onUsage: (t: number) => void addTokenUsage(userId, t),
        onCall: sink.onCall,
      },
      // ROUTE.fix — Opus 5 no-thinking like the ghost (2026-07-27); the
      // differential gate below still decides whether the mend ships.
      { ...ROUTE.fix, trace: { kind: "ide-fix" } },
    );
    const fixed = raw
      .replace(/^\s*```[a-z]*\r?\n?/i, "")
      .replace(/\r?\n?```\s*$/i, "")
      .trim()
      // Sonnet's single-backtick wrapper habit — edge backticks are never code
      // in our dialect (see cleanCompletion).
      .replace(/^`+/, "")
      .replace(/`+$/, "")
      .trim();
    // Nothing to mend, or the model gave up — say so honestly.
    if (!fixed || fixed === code.trim()) return Response.json({ code: "" });
    // THE GATE: the mend may not introduce errors the pane didn't already
    // have (the runtime error being fixed isn't visible to the static gate,
    // so "no new static errors" is the right differential bar).
    const errsOf = async (s: string): Promise<string[]> => {
      if (pane === "hydra") return hydraServerErrors(s);
      const { validateStrudel } = await import("@/lib/strudel-validate");
      return validateStrudel(s).errors;
    };
    const had = new Set(await errsOf(code));
    const added = (await errsOf(fixed)).filter((e) => !had.has(e));
    if (added.length) {
      console.log(`[klappn] fix dropped (${pane}): ${added[0]}`);
      return Response.json({ code: "" });
    }
    return Response.json(sealDeep({ code: fixed }));
  } catch (e) {
    console.error("[klappn] fix failed:", e);
    return Response.json({ code: "" });
  } finally {
    await sink.flush();
  }
}
