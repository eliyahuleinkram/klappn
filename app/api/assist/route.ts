import { getUserId } from "@/lib/session";
import { addTokenUsage, releaseReservation, reserveQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";
import { complete, ROUTE } from "@/lib/llm";
import { sealDeep } from "@/lib/seal";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";
import { hydraServerErrors } from "@/lib/hydra-eval";
import {
  ASSIST_SYSTEM,
  assistUserText,
  parseAssist,
  type AssistProposal,
} from "@/lib/zaltz-assist";
import { SKETCH_CODE_MAX } from "@/lib/sketches";

export const dynamic = "force-dynamic";

/**
 * THE IDE'S ONE AI CALL — propose a revision of the coder's panes. The coder
 * writes what they want changed; the model returns whole revised panes; the
 * CLIENT shows the proposal and the coder takes it or bins it. Nothing here
 * ever writes to a sketch — the editor is the coder's.
 *
 * Same discipline as every AI route: atomic quota reservation before work,
 * real usage metered per call, full trajectory captured for training, response
 * sealed. Validation runs the app-safe static gates (validateStrudel without a
 * tempo ctx — the IDE has no house tempo — and hydraServerErrors), with ONE
 * repair pass; anything still unclean ships as `issues` next to the code, told
 * straight — the coder can read an error.
 */
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) {
    // The client mints a guest session on this code, then retries.
    return Response.json(
      { error: "session required", code: "session_required" },
      { status: 401 },
    );
  }
  if (!(await rateLimit(`assist:ip:${clientIp(req)}`, 40, 600))) return tooMany();

  const body = (await req.json().catch(() => null)) as {
    strudel?: unknown;
    hydra?: unknown;
    ask?: unknown;
  } | null;
  const ask = typeof body?.ask === "string" ? body.ask.trim().slice(0, 500) : "";
  if (!ask) return Response.json({ error: "ask required" }, { status: 400 });
  const strudel =
    typeof body?.strudel === "string" ? body.strudel.slice(0, SKETCH_CODE_MAX) : "";
  const hydra =
    typeof body?.hydra === "string" ? body.hydra.slice(0, SKETCH_CODE_MAX) : "";

  const gate = await reserveQuota(userId);
  if (!gate.ok) return gate.response;
  const sink = makeCallSink();
  try {
    const cfg = {
      model: "opus",
      onUsage: (t: number) => void addTokenUsage(userId, t),
      onCall: sink.onCall,
    };
    const userText = assistUserText(strudel, hydra, ask);
    const raw = await complete(ASSIST_SYSTEM, userText, cfg, {
      ...ROUTE.compose,
      trace: { kind: "ide-assist" },
    });
    let proposal = parseAssist(raw);
    if (proposal.strudel === undefined && proposal.hydra === undefined) {
      return Response.json(
        { error: "The machine came back empty — ask again." },
        { status: 502 },
      );
    }

    // Gate what the model wrote; one repair pass on hard errors.
    let issues = await gateProposal(proposal);
    if (issues.length) {
      const repairText = `${userText}

YOUR PREVIOUS TAKE:
${raw}

GATE — fix exactly these, nothing else; same output shape, full pane(s):
${issues.map((e) => `- ${e}`).join("\n")}`;
      try {
        const repaired = parseAssist(
          await complete(ASSIST_SYSTEM, repairText, cfg, {
            ...ROUTE.compose,
            trace: { kind: "ide-assist", attempt: 1 },
          }),
        );
        // The repair may return only the broken pane — merge over the first take.
        proposal = {
          strudel: repaired.strudel ?? proposal.strudel,
          hydra: repaired.hydra ?? proposal.hydra,
          note: repaired.note ?? proposal.note,
        };
        issues = await gateProposal(proposal);
      } catch (e) {
        console.error("[klappn] assist repair failed — shipping first take", e);
      }
    }

    return Response.json(
      sealDeep({
        strudel: proposal.strudel,
        hydra: proposal.hydra,
        note: proposal.note,
        ...(issues.length ? { issues } : {}),
      }),
    );
  } catch (e) {
    console.error("[klappn] assist failed:", e);
    return Response.json(
      { error: "The machine dropped the take — ask again." },
      { status: 502 },
    );
  } finally {
    await releaseReservation(gate.id);
    await sink.flush();
  }
}

/** Hard errors only — the IDE has no house tempo/key, so no ctx is passed. */
async function gateProposal(p: AssistProposal): Promise<string[]> {
  const issues: string[] = [];
  if (p.strudel !== undefined && p.strudel.trim()) {
    const { validateStrudel } = await import("@/lib/strudel-validate");
    issues.push(...validateStrudel(p.strudel).errors.map((e) => `strudel: ${e}`));
  }
  if (p.hydra !== undefined && p.hydra.trim()) {
    issues.push(...hydraServerErrors(p.hydra).map((e) => `hydra: ${e}`));
  }
  return issues;
}
