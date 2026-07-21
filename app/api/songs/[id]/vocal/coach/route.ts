import { coachVocalTake, type SongPlan } from "@/lib/anthropic";
import { getUserId, unauthorized } from "@/lib/session";
import { getSongWithParts } from "@/lib/songs";
import { addTokenUsage, releaseReservation, reserveQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";

export const dynamic = "force-dynamic";

/**
 * THE VOCAL COACH — one Fable call that listens to the song's identity (genre,
 * mode, groove, sections) plus the take's measured pitch behaviour, and returns
 * the correction chart (true scale incl. mode, grid, tune/timing/clean
 * strengths) + the FX seat + three named one-tap looks. The browser's DSP does
 * the work; this call supplies the musical judgment.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;

  const gate = await reserveQuota(userId);
  if (!gate.ok) return gate.response;
  try {

  const body = (await req.json().catch(() => ({}))) as {
    stats?: {
      medianF0?: number;
      minF0?: number;
      maxF0?: number;
      voicedRatio?: number;
      seconds?: number;
    };
    hint?: string;
  };
  const s = body.stats ?? {};
  const num = (v: unknown, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : d;

  const sp = await getSongWithParts(id, userId);
  if (!sp) return Response.json({ error: "not found" }, { status: 404 });
  const plan = (sp.song.plan as SongPlan) || { summary: "", bpm: 120, key: "A minor", parts: [] };

  const sink = makeCallSink({ songId: id });
  const coach = await coachVocalTake(
    {
      plan,
      sections: [...sp.parts]
        .sort((a, b) => a.position - b.position)
        .map((p) => ({ label: p.label ?? "", intent: p.intent ?? "" })),
      stats: {
        medianF0: num(s.medianF0, 0),
        minF0: num(s.minF0, 0),
        maxF0: num(s.maxF0, 0),
        voicedRatio: Math.max(0, Math.min(1, num(s.voicedRatio, 0))),
        seconds: Math.max(0, num(s.seconds, 0)),
      },
      hint: (body.hint || "").trim().slice(0, 500) || undefined,
    },
    {
      onUsage: (t) => void addTokenUsage(userId, t),
      onCall: sink.onCall,
      model: sp.song.model ?? "anthropic",
    },
  );
  await sink.flush();

  if (!coach) {
    return Response.json(
      { error: "The coach didn't answer — the dials are still yours." },
      { status: 502 },
    );
  }
  return Response.json({ coach });
  } finally {
    await releaseReservation(gate.id);
  }
}
