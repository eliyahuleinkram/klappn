import { getUserId } from "@/lib/session";
import { addTokenUsage, assertQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";
import { complete } from "@/lib/llm";
import { sealDeep } from "@/lib/seal";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";
import { hydraServerErrors } from "@/lib/hydra-eval";
import {
  cleanCompletion,
  COMPLETE_HYDRA_SYSTEM,
  COMPLETE_STRUDEL_SYSTEM,
  completeUserParts,
} from "@/lib/zaltz-assist";

export const dynamic = "force-dynamic";

/**
 * THE COPILOT'S FAST LANE — one ghost-text completion at the caret. Runs on
 * OPUS 5 with thinking DISABLED (2026-07-26 switch from Sonnet after wrong
 * hydra ghosts shipped — `.out().brightness()` crashed live; no-thinking keeps
 * the latency, Opus keeps the dialect straight) with the OTHER pane as
 * read-only context — a hydra ghost should know the loop it lights.
 *
 * And the Copilot/Cursor lesson applied: the model is only half the product —
 * the other half is FILTERING. Every ghost is gated by the same static checks
 * the assist path uses, DIFFERENTIALLY (only errors the ghost would ADD count
 * — the coder's own unfinished pane is allowed to be unfinished). A ghost that
 * fails gets ONE fast repair pass, then dies silently: no ghost beats a wrong
 * ghost.
 *
 * Quota: assertQuota (the cheap pre-flight), not a reservation — a completion
 * is ~1-2k weighted units and the rate limit bounds parallel abuse. Spend is
 * metered via addTokenUsage, trajectories captured like every call.
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
    context?: unknown;
  } | null;
  const pane = body?.pane === "hydra" ? "hydra" : "strudel";
  const before = typeof body?.before === "string" ? body.before.slice(-4000) : "";
  const after = typeof body?.after === "string" ? body.after.slice(0, 2000) : "";
  const context =
    typeof body?.context === "string" ? body.context.slice(0, 2500) : "";
  if (!before.trim()) return Response.json({ ghost: "" });

  const gate = await assertQuota(userId);
  if (gate) return gate;

  const system = pane === "hydra" ? COMPLETE_HYDRA_SYSTEM : COMPLETE_STRUDEL_SYSTEM;
  // Cache split: the other-pane context is byte-stable across a typing burst,
  // so it rides cacheStable (its own cache-marked block after the system) and
  // every summon re-reads [system + context] at ~0.1× — only BEFORE/AFTER pay
  // full rate. (Verify in tail: `anthropic(...) cache: read=…`.)
  const { stable, tail } = completeUserParts(
    before,
    after,
    context,
    pane === "hydra" ? "STRUDEL PANE" : "HYDRA PANE",
  );
  const sink = makeCallSink();
  try {
    // OPUS 5, thinking off (2026-07-27, launch call): ghost quality over
    // pennies — billed at Opus's own rate via MODEL_COST_FACTOR. Thinking
    // stays off; the tight cap keeps latency in ghost territory.
    const cfg = {
      model: "opus",
      onUsage: (t: number) => void addTokenUsage(userId, t),
      onCall: sink.onCall,
    };
    // NO fast mode (2× price for 2.5× tok/s — not worth it here): thinking-off
    // + a tight cap IS the latency lever. 400 gives a ~6-line ghost real room —
    // a cap-truncated ghost only dies at the gate AFTER burning a repair pass.
    const opts = {
      thinking: false,
      maxTokens: 400,
      ...(stable ? { cacheStable: stable } : {}),
    } as const;
    let ghost = cleanCompletion(
      await complete(system, tail, cfg, {
        ...opts,
        trace: { kind: "ide-complete" },
      }),
      before,
    );
    // THE FILTER: a ghost may not introduce errors the pane didn't already
    // have. One fast repair pass, then silence — no ghost beats a wrong ghost.
    let issues = await ghostIssues(pane, before, after, ghost);
    // THE NEWLINE SALVAGE (2026-07-26, the "copilot doesn't work for visuals"
    // bug): the commonest corpse is a perfect ghost glued to the end of the
    // line — `…out()src(o0)…` — which the gate reads as a syntax error and
    // kills. Before burning a model repair pass, try the one-character fix.
    if (issues.length && ghost && !ghost.startsWith("\n")) {
      const nl = "\n" + ghost;
      if (!(await ghostIssues(pane, before, after, nl)).length) {
        ghost = nl;
        issues = [];
      }
    }
    if (issues.length) {
      try {
        ghost = cleanCompletion(
          await complete(
            system,
            `${tail}

YOUR PREVIOUS COMPLETION:
${ghost}

GATE — it breaks the pane; fix exactly these and output only the corrected insertion:
${issues.map((e) => `- ${e}`).join("\n")}`,
            cfg,
            { ...opts, trace: { kind: "ide-complete", attempt: 1 } },
          ),
          before,
        );
        issues = await ghostIssues(pane, before, after, ghost);
      } catch {
        issues = ["repair failed"];
      }
      if (issues.length) {
        // Log the corpse too — "dropped: syntax error" alone made a gate bug
        // undiagnosable from tail (2026-07-26: the gate itself was the fault).
        console.log(
          `[klappn] ghost dropped (${pane}): ${issues[0]} :: ${JSON.stringify(ghost.slice(0, 200))}`,
        );
        return Response.json({ ghost: "" });
      }
    }
    return Response.json(sealDeep({ ghost }));
  } catch (e) {
    console.error("[klappn] complete failed:", e);
    return Response.json({ ghost: "" }); // a missing ghost is not an error state
  } finally {
    await sink.flush();
  }
}

/** Errors the ghost would ADD to the pane (differential — the coder's own
 *  unfinished code is allowed to be unfinished). */
async function ghostIssues(
  pane: "strudel" | "hydra",
  before: string,
  after: string,
  ghost: string,
): Promise<string[]> {
  if (!ghost.trim()) return [];
  const whole = before + ghost + after;
  const base = before + after;
  if (pane === "hydra") {
    const had = new Set(hydraServerErrors(base));
    return hydraServerErrors(whole).filter((e) => !had.has(e));
  }
  const { validateStrudel } = await import("@/lib/strudel-validate");
  const had = new Set(validateStrudel(base).errors);
  return validateStrudel(whole).errors.filter((e) => !had.has(e));
}
