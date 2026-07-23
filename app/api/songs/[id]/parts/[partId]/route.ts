import {
  getPartsOrdered,
  getSong,
  patchSongPlan,
  removePart,
  reorderPart,
  replacePartIntent,
  restorePartOriginal,
  setPartEditChoice,
  setPartLabel,
  setPartStrudelOwned,
  syncWornSnapshot,
} from "@/lib/songs";
import type { SongPlan } from "@/lib/anthropic";
import { getUserId, unauthorized } from "@/lib/session";
import { triggerGeneration } from "@/lib/workflows";
import {
  deleteTrack,
  enrichPartLayer,
  repairPart,
  repairPartVisual,
  setTrackControl,
  setTrackInstrument,
  setTrackMuted,
} from "@/lib/jobs";
import { addTokenUsage, releaseReservation, reserveQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";
import { flagIssue } from "@/lib/issues";
import { sealDeep } from "@/lib/seal";
import { cleanLabel } from "@/lib/labels";
import { applySwap, setControlValue } from "@/lib/controls";
import { sanitizeDuckTargets } from "@/lib/reverb-orbits";

async function ownedSong(req: Request, id: string) {
  const userId = await getUserId(req);
  if (!userId) return { error: unauthorized() };
  const song = await getSong(id, userId);
  if (!song) return { error: Response.json({ error: "not found" }, { status: 404 }) };
  return { userId, song };
}

// Remove a part and close the position gap. Deleting is INSTANT and deterministic — no AI
// reworks the seam anymore: the former neighbours meet on a clean on-beat butt-join, and any
// break the user wants there they place themselves (arrange surface). We only tidy the plan:
// the deleted loop's own break entry is orphaned, so drop it.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; partId: string }> },
) {
  const { id, partId } = await params;
  const owned = await ownedSong(req, id);
  if (owned.error) return owned.error;

  await removePart(id, partId);

  try {
    const after = await getSong(id, owned.userId);
    const plan = (after?.plan ?? {}) as SongPlan & {
      breaks?: Record<string, unknown>;
    };
    if (plan.breaks && partId in plan.breaks) {
      const breaks = { ...plan.breaks };
      delete breaks[partId];
      await patchSongPlan(id, owned.userId, { breaks });
    }
  } catch (e) {
    console.error(`[klappn] post-delete break cleanup failed for ${id}:`, e);
  }

  return Response.json({ ok: true });
}

/**
 * Operations on one part:
 *   { op: "reorder", toPosition }     -> move the part
 *   { op: "replace", intent, label? } -> new intent, reset to pending, regenerate
 *   { op: "control", values }         -> set named tweak consts ({name: number})
 *                                        SURGICALLY on the server's current code
 *   { op: "swap", from, to }          -> swap one sound name, same surgical rule
 *   { op: "track-enrich", layer }     -> LAZY: build that layer's tweak panel on
 *                                        its card's first open (one cheap call)
 *   { op: "strudel", strudel }        -> set the code directly (whole-code; only
 *                                        for flows that OWN the entire program)
 *
 * "control"/"swap" exist because whole-code writes from the client are
 * lost-update prone: a client holding stale code (e.g. a cached page) would
 * silently erase anything added server-side since — that's how a loop's
 * freshly-painted visuals got wiped. Sliders and instrument swaps therefore
 * send their DELTA and the server rewrites only that const / sound name.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; partId: string }> },
) {
  const { id, partId } = await params;
  const owned = await ownedSong(req, id);
  if (owned.error) return owned.error;

  const body = (await req.json().catch(() => null)) as
    | { op: "reorder"; toPosition: number }
    | { op: "replace"; intent: string; label?: string }
    | { op: "control"; values: Record<string, number> }
    | { op: "swap"; from: string; to: string; layer?: number }
    | { op: "track-control"; layer: number; values: Record<string, number> }
    | { op: "track-sound"; layer: number; via: "sound" | "bank"; value: string }
    | { op: "track-mute"; layer: number; muted: boolean }
    | { op: "track-delete"; layer: number }
    | { op: "track-enrich"; layer: number }
    | { op: "strudel"; strudel: string }
    | { op: "label"; label: string }
    | { op: "restore" }
    | { op: "repair"; error: string }
    | { op: "repair-visual"; error: string }
    | null;

  // SELF-HEAL — the browser player reported a runtime error for this loop; repair it (ONE AI call,
  // inline) from the server's CURRENT code and return the fixed program so the client re-plays it.
  // op "repair" = the AUDIO loop; op "repair-visual" = the @hydra VISUAL (same pattern, separate fix).
  if (body?.op === "repair" || body?.op === "repair-visual") {
    const err = typeof body.error === "string" ? body.error.slice(0, 2000).trim() : "";
    if (!err) return Response.json({ error: "error required" }, { status: 400 });
    const gate = await reserveQuota(owned.userId);
    if (!gate.ok) return gate.response;
    try {
    const heal = body.op === "repair-visual" ? repairPartVisual : repairPart;
    // Every browser-reported error is an issue — it means something slipped every server gate.
    await flagIssue(
      body.op === "repair-visual" ? "browser-hydra-error" : "browser-strudel-error",
      err,
      { songId: id, partId },
    );
    const sink = makeCallSink({ songId: id, partId });
    const repaired = await heal(id, partId, err, {
      onUsage: (t) => void addTokenUsage(owned.userId, t),
      onCall: sink.onCall,
      model: owned.song.model,
    }).catch((e) => {
      console.error(`[klappn] ${body.op} failed for part ${partId}:`, e);
      return null;
    });
    await sink.flush();
    if (!repaired)
      await flagIssue(`${body.op}-failed`, `self-heal could not fix: ${err.slice(0, 500)}`, {
        songId: id,
        partId,
      });
    return repaired
      ? Response.json(sealDeep({ ok: true, repaired }))
      : Response.json({ ok: false, repaired: null });
    } finally {
      await releaseReservation(gate.id);
    }
  }


  // LAZY ENRICH — build this ONE layer's tweak panel on the card's first open (generation
  // no longer pre-pays panels for layers nobody opens). Idempotent: an already-enriched
  // layer returns without a model call. Metered like any other AI work on the song. The
  // response carries the PANEL only (no code) — the client keeps its own line verbatim.
  if (body?.op === "track-enrich") {
    const layer = Math.round(Number(body.layer));
    if (!Number.isInteger(layer) || layer < 0) {
      return Response.json({ error: "layer (>=0) required" }, { status: 400 });
    }
    const gate = await reserveQuota(owned.userId);
    if (!gate.ok) return gate.response;
    try {
      const sink = makeCallSink({ songId: id, partId });
      const track = await enrichPartLayer(id, partId, layer, {
        onUsage: (t) => void addTokenUsage(owned.userId, t),
        onCall: sink.onCall,
        model: owned.song.model,
      }).catch((e) => {
        console.error(`[klappn] track-enrich failed for part ${partId} layer ${layer}:`, e);
        return null;
      });
      await sink.flush();
      if (!track) return Response.json({ ok: false });
      const { label, signature, controls, pills, swap } = track;
      return Response.json({
        ok: true,
        layer,
        panel: { label, signature, controls, pills, swap, enriched: true },
      });
    } finally {
      await releaseReservation(gate.id);
    }
  }

  // Per-track ops (knobs / mute / delete) — all layer-indexed,
  // handled by the jobs core which keeps parts.tracks + the merged code in sync.
  if (
    body?.op === "track-control" ||
    body?.op === "track-sound" ||
    body?.op === "track-mute" ||
    body?.op === "track-delete"
  ) {
    const layer = Math.round(Number(body.layer));
    if (!Number.isInteger(layer) || layer < 0) {
      return Response.json({ error: "layer (>=0) required" }, { status: 400 });
    }
    if (body.op === "track-mute") {
      await setTrackMuted(id, partId, layer, !!body.muted);
    } else if (body.op === "track-delete") {
      await deleteTrack(id, partId, layer);
    } else if (body.op === "track-sound") {
      const via = body.via === "bank" ? "bank" : "sound";
      const value = String(body.value ?? "").trim();
      if (!value) return Response.json({ error: "value required" }, { status: 400 });
      await setTrackInstrument(id, partId, layer, via, value);
    } else {
      const values: Record<string, number> = {};
      for (const [k, v] of Object.entries(body.values ?? {})) {
        const n = Number(v);
        if (typeof k === "string" && Number.isFinite(n)) values[k] = n;
      }
      if (!Object.keys(values).length) {
        return Response.json({ error: "values required" }, { status: 400 });
      }
      await setTrackControl(id, partId, layer, values);
    }
    return Response.json({ ok: true });
  }

  // Surgical tweak writes — rewrite ONLY the named consts / sound name on the
  // CURRENT server code (never trust the client's whole program; see above).
  if (body?.op === "control" || body?.op === "swap") {
    const parts = await getPartsOrdered(id);
    const part = parts.find((p) => p.id === partId);
    if (!part?.strudel?.trim()) {
      return Response.json({ error: "part has no music" }, { status: 404 });
    }
    let code = part.strudel;
    if (body.op === "control") {
      const entries = Object.entries(body.values ?? {}).slice(0, 24);
      if (entries.length === 0) {
        return Response.json({ error: "values required" }, { status: 400 });
      }
      for (const [name, v] of entries) {
        const num = Number(v);
        if (typeof name === "string" && Number.isFinite(num)) {
          code = setControlValue(code, name, num);
        }
      }
    } else {
      const from = typeof body.from === "string" ? body.from.slice(0, 80) : "";
      const to = typeof body.to === "string" ? body.to.slice(0, 80) : "";
      if (!from || !to) {
        return Response.json({ error: "from and to required" }, { status: 400 });
      }
      const layer =
        Number.isFinite(Number(body.layer)) && Number(body.layer) >= 1
          ? Math.round(Number(body.layer))
          : undefined;
      code = applySwap(code, from, to, layer);
    }
    // Opportunistic repair: older loops may carry a duck aimed at a missing
    // orbit (a per-cycle superdough error) — heal it on any tweak write.
    code = sanitizeDuckTargets(code);
    if (code !== part.strudel) {
      await setPartStrudelOwned(id, partId, code);
      // Your manual edit belongs to the identity you're WEARING — Original or
      // a style — so switching away and back returns the loop as you left it.
      await syncWornSnapshot(partId, code);
    }
    return Response.json(sealDeep({ ok: true, strudel: code }));
  }

  // Walk an AI-edited part back to its first composition (the Original pill).
  if (body?.op === "restore") {
    const strudel = await restorePartOriginal(id, partId);
    if (!strudel)
      return Response.json({ error: "no original to restore" }, { status: 404 });
    await setPartEditChoice(partId, null);
    return Response.json(sealDeep({ ok: true, strudel }));
  }

  if (body?.op === "label") {
    const ok = await setPartLabel(id, partId, cleanLabel(body.label));
    if (!ok) return Response.json({ error: "part not found" }, { status: 404 });
    return Response.json({ ok: true });
  }

  if (body?.op === "strudel") {
    const strudel = typeof body.strudel === "string" ? body.strudel : "";
    if (!strudel.trim() || strudel.length > 20000) {
      return Response.json(
        { error: "code (non-empty, <20k chars) required" },
        { status: 400 },
      );
    }
    const ok = await setPartStrudelOwned(id, partId, strudel);
    if (!ok) return Response.json({ error: "part not found" }, { status: 404 });
    return Response.json({ ok: true });
  }

  if (body?.op === "reorder") {
    if (typeof body.toPosition !== "number" || body.toPosition < 0) {
      return Response.json({ error: "toPosition (>=0) required" }, { status: 400 });
    }
    await reorderPart(id, partId, Math.floor(body.toPosition));
    return Response.json({ ok: true });
  }

  if (body?.op === "replace") {
    if (!body.intent?.trim()) {
      return Response.json({ error: "intent required" }, { status: 400 });
    }
    const part = await replacePartIntent(
      id,
      partId,
      body.label?.trim() ?? null,
      body.intent.trim(),
    );
    if (!part) return Response.json({ error: "part not found" }, { status: 404 });
    // Regenerate just this (now pending) loop. If the trigger fails the part is
    // already safely "pending" (it has a Generate button) — just say so.
    let workflowId: string;
    try {
      workflowId = await triggerGeneration(id, partId);
    } catch (e) {
      console.error(`[klappn] replace trigger failed for part ${partId}:`, e);
      return Response.json(
        { error: "Saved, but composing didn’t start — tap Generate." },
        { status: 502 },
      );
    }
    return Response.json(sealDeep({ part, workflowId }));
  }

  return Response.json({ error: "unknown op" }, { status: 400 });
}
