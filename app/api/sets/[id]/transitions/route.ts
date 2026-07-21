import { generateBreaks, type SongPlan } from "@/lib/anthropic";
import { getUserId, unauthorized } from "@/lib/session";
import {
  entriesOf,
  getSetHydrated,
  saveSetTransition,
  setSetTransitionChoice,
  type SetPlan,
} from "@/lib/sets";
import { stripHydraBlock } from "@/lib/hydra-embed";
import { stripMetaBlocks } from "@/lib/controls";
import { strudelServerErrors } from "@/lib/strudel-interp";
import { flagIssue } from "@/lib/issues";
import { sealDeep } from "@/lib/seal";
import { addTokenUsage, releaseReservation, reserveQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";

/**
 * Compose THE HAND-OFF for one set boundary — a one-bar easing between the last
 * loop of the entry `fromEntryId`'s song and the first loop of the next entry's
 * song, AI-written from both loops' code and AUTO-APPLIED the moment it lands.
 * Same compose/gate/retry shape as the song-level breaks route; the break plays
 * at the INCOMING song's tempo (it's the landing, not the departure), and the
 * model is told the outgoing song's bpm/key so it bridges rather than restates.
 * Body `{ fromEntryId, regenerate? }`.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    fromEntryId?: string;
    regenerate?: boolean;
  };
  if (!body.fromEntryId) {
    return Response.json({ error: "fromEntryId required" }, { status: 400 });
  }

  const bundle = await getSetHydrated(id, userId);
  if (!bundle) return Response.json({ error: "not found" }, { status: 404 });
  const entries = entriesOf(bundle.set.plan);
  const i = entries.findIndex((e) => e.id === body.fromEntryId);
  const fromEntry = entries[i];
  const toEntry = entries.length > 1 ? entries[(i + 1) % entries.length] : undefined;
  if (!fromEntry || !toEntry) {
    return Response.json(
      { error: "this boundary needs two songs around it" },
      { status: 409 },
    );
  }

  const songOf = (songId: string) => bundle.songs.find((s) => s.song.id === songId);
  const fromBundle = songOf(fromEntry.songId);
  const toBundle = songOf(toEntry.songId);
  const playable = (b?: { parts: { strudel?: string | null }[] }) =>
    (b?.parts ?? []).filter((p) => p.strudel?.trim());
  const fromPart = playable(fromBundle).at(-1);
  const toPart = playable(toBundle).at(0);
  if (!fromPart || !toPart || !fromBundle || !toBundle) {
    return Response.json(
      { error: "both songs around this boundary must be finished first" },
      { status: 409 },
    );
  }

  // Already composed for this boundary → return the cached set (choosing is free).
  const plan = (bundle.set.plan ?? {}) as SetPlan;
  const existing = plan.transitions?.[fromEntry.id];
  if (existing?.options?.length && !body.regenerate) {
    return Response.json(sealDeep({ ok: true, set: existing }));
  }

  const gate = await reserveQuota(userId);
  if (!gate.ok) return gate.response;
  try {

  const fromPlan = (fromBundle.song.plan ?? {}) as SongPlan;
  const toPlan = (toBundle.song.plan ?? {}) as SongPlan;

  // Hand the model each neighbour as its per-layer Strudel (`notation`), falling
  // back to the stripped played code — same as the song-level breaks route.
  const neighbourContext = (p: { tracks?: unknown; strudel?: string | null }): string => {
    const tks = (Array.isArray(p.tracks) ? p.tracks : []) as Array<{ notation?: string }>;
    return tks.length && tks.every((t) => t.notation)
      ? tks.map((t) => `$: ${t.notation}`).join("\n")
      : stripMetaBlocks(stripHydraBlock(p.strudel ?? ""));
  };

  const sink = makeCallSink({ songId: toBundle.song.id }); // the incoming song anchors the row
  const options: { label: string; strudel: string }[] = [];
  let feedback = "";
  for (let attempt = 0; attempt < 3 && options.length === 0; attempt++) {
    const candidates = await generateBreaks(
      {
        plan: toPlan, // the hand-off plays at the INCOMING song's tempo/key
        fromMusic: neighbourContext(fromPart),
        toMusic: neighbourContext(toPart),
        feedback: attempt === 1 ? feedback : undefined, // attempt 2 fixes; attempt 3 rolls fresh
        crossSong: { fromBpm: fromPlan.bpm, fromKey: fromPlan.key },
      },
      {
        onUsage: (t) => void addTokenUsage(userId, t),
        onCall: sink.onCall,
        model: toBundle.song.model ?? "anthropic",
      },
    );
    for (const c of candidates) {
      const errs = await strudelServerErrors(c.strudel, {
        bpm: toPlan.bpm,
        timeSignature: toPlan.timeSignature,
      });
      if (errs.length) {
        feedback = errs.join("\n");
        await flagIssue("set-transition-gate", errs.join("; "), {
          songId: toBundle.song.id,
        });
        continue;
      }
      options.push(c);
    }
  }
  await sink.flush();
  if (options.length === 0) {
    await flagIssue(
      "set-transition-compose-failed",
      "no candidate passed the gate after 3 attempts",
      { songId: toBundle.song.id },
    );
    return Response.json(
      { error: "Couldn’t compose the transition for this boundary — try again." },
      { status: 502 },
    );
  }

  const saved = await saveSetTransition(id, userId, fromEntry.id, options);
  if (!saved) return Response.json({ error: "not found" }, { status: 404 });
  // Freshly composed → wear it right away.
  await setSetTransitionChoice(id, userId, fromEntry.id, 0);
  return Response.json(sealDeep({ ok: true, set: { ...saved, chosen: 0 } }));
  } finally {
    await releaseReservation(gate.id);
  }
}
