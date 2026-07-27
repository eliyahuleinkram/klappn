import { getUserId } from "@/lib/session";
import { addTokenUsage, assertQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";
import { complete } from "@/lib/llm";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * STEM NAMES for the take card (2026-07-27, user: "reading gm_pad_halo does
 * not mean anything to anyone"). One cheap Sonnet 5 no-thinking call at cut:
 * each stem's raw engine sound ids in, one plain producer's word per stem
 * out. Cosmetic and OPTIONAL by contract — the client falls back to the bare
 * sound names on any failure, so this route answers { names: null } instead
 * of erroring wherever it can't (or shouldn't) run.
 */

const SYSTEM = `You name the stems of a live-coded music take. Input: numbered tracks, each a list of raw engine sound ids (drum machine codes like "bd"/"hh", synth waves, gm_ soundfont names). Answer ONLY a JSON array of strings with EXACTLY one label per numbered track, in number order — same count as tracks, always, even when two tracks have identical sounds (repeat or vary the label, but never merge or skip a track). A label is 1-3 lowercase plain words a producer would say — "halo pad", "909 drums", "acid bass", "hats" — never a raw id, never punctuation beyond spaces.`;

export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return Response.json({ names: null });
  if (!(await rateLimit(`take-names:ip:${clientIp(req)}`, 10, 60))) return tooMany();

  const body = (await req.json().catch(() => null)) as { stems?: unknown } | null;
  const stems = Array.isArray(body?.stems) ? body.stems.slice(0, 16) : null;
  if (!stems?.length) return Response.json({ names: null });
  const lists = stems.map((l) =>
    (Array.isArray(l) ? l : [])
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.slice(0, 48))
      .slice(0, 6),
  );
  if (!lists.some((l) => l.length)) return Response.json({ names: null });

  const gate = await assertQuota(userId);
  if (gate) return Response.json({ names: null }); // spent machine — bare names, silently

  const sink = makeCallSink();
  try {
    // NUMBERED tracks (2026-07-27, "sawtooth" twice in one take): identical
    // lists made the model merge tracks and answer one short — the length
    // gate then killed EVERY name. Numbers make the count contract literal.
    const numbered = lists
      .map((l, i) => `${i + 1}. ${l.join(", ") || "(silent)"}`)
      .join("\n");
    // Two attempts: a mangled answer (wrong length, prose, fences) is cheap
    // to re-roll and the alternative is a whole card of raw engine ids.
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await complete(
        SYSTEM,
        numbered,
        {
          model: "sonnet", // the cheap-call pin — naming needs no composing tier
          onUsage: (t: number) => void addTokenUsage(userId, t),
          onCall: sink.onCall,
        },
        { thinking: false, maxTokens: 300, trace: { kind: "take-names" } },
      );
      try {
        const parsed: unknown = JSON.parse(
          raw.replace(/^\s*```[a-z]*\r?\n?/i, "").replace(/\r?\n?```\s*$/i, "").trim(),
        );
        if (
          Array.isArray(parsed) &&
          parsed.length === lists.length &&
          parsed.every((n) => typeof n === "string" && n.trim())
        )
          return Response.json({
            names: (parsed as string[]).map((n) => n.trim().toLowerCase().slice(0, 28)),
          });
      } catch {
        /* unparseable — fall through to the retry */
      }
      // The RAW reply in the log — a silent all-bare card told us nothing
      // twice; next time the log says exactly what the model answered.
      console.warn(
        `[klappn] take-names attempt ${attempt + 1} unusable for ${lists.length} tracks: ${raw.slice(0, 200)}`,
      );
    }
    return Response.json({ names: null });
  } catch (e) {
    console.error("[klappn] take-names failed:", e);
    return Response.json({ names: null });
  } finally {
    await sink.flush();
  }
}
