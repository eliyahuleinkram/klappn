import { getUserId } from "@/lib/session";
import { addTokenUsage, assertQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";
import { complete, ROUTE } from "@/lib/llm";
import { sealDeep } from "@/lib/seal";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";
import { hydraServerErrors } from "@/lib/hydra-eval";
import {
  EDIT_SEL_HYDRA_SYSTEM,
  EDIT_SEL_STRUDEL_SYSTEM,
  editSelUserText,
} from "@/lib/zaltz-assist";

export const dynamic = "force-dynamic";

/**
 * THE SELECTION EDIT (2026-07-28) — the copilot PERFORMS an edit: the coder
 * selects a span, says the change, and this returns the replacement for
 * exactly that span. Same doctrine as the ghost: the model is half the
 * product, the FILTER is the other half — the spliced file may not carry
 * errors the original didn't (differential gate), and a failed edit returns
 * empty rather than shipping a broken splice. ROUTE.assist — Opus 5, thinking
 * off; metered + captured like every call.
 */
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) {
    return Response.json(
      { error: "session required", code: "session_required" },
      { status: 401 },
    );
  }
  if (!(await rateLimit(`editsel:ip:${clientIp(req)}`, 20, 60))) return tooMany();

  const body = (await req.json().catch(() => null)) as {
    pane?: unknown;
    code?: unknown;
    start?: unknown;
    end?: unknown;
    ask?: unknown;
  } | null;
  const pane = body?.pane === "hydra" ? "hydra" : "strudel";
  const code = typeof body?.code === "string" ? body.code.slice(0, 20000) : "";
  const start = typeof body?.start === "number" ? Math.floor(body.start) : -1;
  const end = typeof body?.end === "number" ? Math.floor(body.end) : -1;
  const ask = typeof body?.ask === "string" ? body.ask.slice(0, 300).trim() : "";
  if (!code.trim() || !ask || start < 0 || end <= start || end > code.length) {
    return Response.json({ code: "" });
  }
  const sel = code.slice(start, end);
  // THE WHOLE PANE is a legitimate span (07-30, the user: "we should be able to
  // make an edit on the entire code, so we do not need to edit by holding down
  // certain sections"). Nothing else about the contract changes — "rewrite
  // exactly this span, smallest change, keep the rest byte-identical" reads the
  // same whether the span is one method call or the file.
  const wholePane = start === 0 && end >= code.trim().length;

  const gate = await assertQuota(userId);
  if (gate) return gate;

  const system = pane === "hydra" ? EDIT_SEL_HYDRA_SYSTEM : EDIT_SEL_STRUDEL_SYSTEM;
  const sink = makeCallSink();
  try {
    let out = (
      await complete(system, editSelUserText(code, sel, ask), {
        onUsage: (t: number) => void addTokenUsage(userId, t),
        onCall: sink.onCall,
      }, {
        // Same agent, two budgets. A span edit answers with a fragment; a WHOLE
        // PANE edit ("make it quieter") answers with the file, and 1200 tokens
        // would truncate it mid-line — which the differential gate would then
        // correctly refuse, so the ask would just silently do nothing.
        ...(wholePane ? ROUTE.rework : ROUTE.assist),
        trace: { kind: "ide-edit" },
      })
    )
      .replace(/^\s*```[a-z]*\r?\n?/i, "")
      .replace(/\r?\n?```\s*$/i, "")
      .replace(/^`+|`+\s*$/g, "");
    if (!out.trim()) return Response.json({ code: "" });
    // [gone] = the model chose DELETION (a first-class edit — "remove this
    // layer" must be sayable). The empty splice rides the same gate.
    const gone = out.trim() === "[gone]";
    if (gone) out = "";
    // THE FILTER — the spliced file may not carry errors the original didn't.
    const whole = code.slice(0, start) + out + code.slice(end);
    const issues = await spliceIssues(pane, code, whole);
    if (issues.length) {
      console.log(`[klappn] selection edit dropped (${pane}): ${issues[0]}`);
      return Response.json({ code: "" });
    }
    return Response.json(sealDeep(gone ? { code: "", gone: true } : { code: out }));
  } catch (e) {
    console.error("[klappn] selection edit failed:", e);
    return Response.json({ code: "" });
  } finally {
    await sink.flush();
  }
}

/** Errors the edit would ADD (differential — the coder's own unfinished
 *  file is allowed to be unfinished; same rule as the ghost gate). */
async function spliceIssues(
  pane: "strudel" | "hydra",
  base: string,
  whole: string,
): Promise<string[]> {
  if (pane === "hydra") {
    const had = new Set(hydraServerErrors(base));
    return hydraServerErrors(whole).filter((e) => !had.has(e));
  }
  const { validateStrudel } = await import("@/lib/strudel-validate");
  const had = new Set(validateStrudel(base).errors);
  return validateStrudel(whole).errors.filter((e) => !had.has(e));
}
