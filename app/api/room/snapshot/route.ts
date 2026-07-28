import { db } from "@/lib/db";
import { getUserId, unauthorized } from "@/lib/session";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * BOILER-ROOM CAPTURE (2026-07-28, the save-save-save law) — the room's
 * authored code lands in room_snapshots for the future model, same corpus
 * doctrine as model_calls ([[save-generation-data-for-training]]; the /open
 * data deal names it). Fire-and-forget from the client, throttled there;
 * this side just refuses garbage: no AI, no quota — capture must be free.
 */
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  if (!(await rateLimit(`roomsnap:ip:${clientIp(req)}`, 60, 60))) return tooMany();

  const body = (await req.json().catch(() => null)) as {
    pane?: unknown;
    event?: unknown;
    code?: unknown;
    meta?: unknown;
  } | null;
  const pane = body?.pane === "hydra" ? "hydra" : "strudel";
  const event =
    typeof body?.event === "string" && /^[a-z-]{1,24}$/.test(body.event)
      ? body.event
      : "eval";
  const code = typeof body?.code === "string" ? body.code.slice(0, 20000) : "";
  if (!code.trim()) return Response.json({ ok: true }); // an empty pane says nothing
  const meta =
    body?.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
      ? (body.meta as Record<string, unknown>)
      : {};
  if (JSON.stringify(meta).length > 2000) {
    return Response.json({ error: "meta too large" }, { status: 413 });
  }

  try {
    const sql = db();
    await sql`
      insert into room_snapshots (user_id, pane, event, code, meta)
      values (${userId}, ${pane}, ${event}, ${code}, ${sql.json(meta as Parameters<typeof sql.json>[0])})`;
  } catch (e) {
    // Capture never breaks the room — log and move on.
    console.error("[klappn] room snapshot failed:", e);
  }
  return Response.json({ ok: true });
}
