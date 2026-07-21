import {
  getSong,
  getPartsOrdered,
  setPartEditChoice,
  setPartMessage,
  setPartStatus,
  setPartStrudelOwned,
  snapshotPartOriginal,
} from "@/lib/songs";
import { carryControlValues } from "@/lib/controls";
import { getUserId, unauthorized } from "@/lib/session";
import { sealDeep } from "@/lib/seal";
import { triggerPartEdit } from "@/lib/workflows";
import { releaseReservation, reserveQuota } from "@/lib/billing";

/**
 * Switch ONE loop between its edit-pill VARIANTS.
 *
 * Body `{ pill: string | null }`:
 *   null     → back to the Original (deterministic, instant — restores the
 *              snapshot taken before the first variant).
 *   "Darker pads" → apply that tapped change to THIS loop only, via the edit
 *              engine (durable workflow). The part flips to "generating" RIGHT
 *              HERE so the card shows progress on the very next poll.
 *
 * Variants are siblings, not a stack — each derives from the original.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; partId: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id, partId } = await params;

  const song = await getSong(id, userId);
  if (!song) return Response.json({ error: "not found" }, { status: 404 });

  const parts = await getPartsOrdered(id);
  const part = parts.find((p) => p.id === partId);
  if (!part) return Response.json({ error: "part not found" }, { status: 404 });
  if (part.status === "generating") {
    return Response.json(
      { error: "This loop is still working — give it a moment." },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    pill?: string | null;
  } | null;
  const pill =
    typeof body?.pill === "string" ? body.pill.trim().slice(0, 40) : null;

  // Back to the original — deterministic and instant. The user's CURRENT knob
  // settings ride along onto every knob the original also has (tweaks are the
  // user's intent — switching takes never resets them).
  if (!pill) {
    const original = part.original_strudel;
    if (!original?.trim()) {
      return Response.json({ error: "no original to restore" }, { status: 404 });
    }
    const carried = carryControlValues(part.strudel ?? "", original);
    await setPartStrudelOwned(id, partId, carried);
    await setPartEditChoice(partId, null);
    return Response.json(sealDeep({ ok: true, strudel: carried }));
  }

  if (!part.strudel?.trim()) {
    return Response.json({ error: "that loop has no music yet" }, { status: 409 });
  }

  // CACHE HIT — this style was already composed once: restore its remembered
  // take instantly (never the model twice), carrying the user's current knob
  // settings onto every knob the take shares.
  const cached = part.variants?.[pill];
  if (cached?.trim()) {
    const carried = carryControlValues(part.strudel ?? "", cached);
    await setPartStrudelOwned(id, partId, carried);
    await setPartEditChoice(partId, pill);
    return Response.json(sealDeep({ ok: true, strudel: carried }));
  }

  // QUOTA GATE — a FIRST-TIME variant rework is real model work. (Restores and
  // cached re-taps, above, are deterministic and always free.)
  const gate = await reserveQuota(userId);
  if (!gate.ok) return gate.response;
  try {

  // Keep the way home BEFORE the first variant, and show progress IMMEDIATELY
  // (the workflow re-asserts both, a touch later) — walking both back if the
  // trigger fails, so the loop can't be stranded "generating".
  await snapshotPartOriginal(partId);
  await setPartStatus(partId, "generating");
  await setPartMessage(partId, `Reworking this loop — “${pill}”…`);

  let workflowId: string;
  try {
    workflowId = await triggerPartEdit(id, partId, pill);
  } catch (e) {
    console.error(`[klappn] variant trigger failed for part ${partId}:`, e);
    await setPartMessage(partId, "").catch(() => {});
    await setPartStatus(partId, "ready").catch(() => {});
    return Response.json(
      { error: "Couldn’t start the rework — try again." },
      { status: 502 },
    );
  }
  return Response.json({ ok: true, workflowId });
  } finally {
    await releaseReservation(gate.id);
  }
}
