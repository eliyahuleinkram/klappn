import { getUserId } from "@/lib/session";
import { recordGesture } from "@/lib/songs";

/**
 * WHAT THE PERSON DID — one deterministic gesture, logged (2026-08-02).
 *
 * Fire-and-forget from the page: where play started, which ending was chosen,
 * a knob released, a kit picked. Never gates anything, never returns an error
 * worth acting on, and never costs a quota — it is a record, not a request.
 *
 * A signed-out visitor on a shared link writes nothing: their tab can't send a
 * mutation at all (SongClient's shared wall), and there is no user to attribute
 * it to. Ownership isn't checked either — a gesture is evidence of what
 * happened, and the song id is already the caller's to know.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    kind?: string;
    data?: Record<string, unknown>;
  };
  const kind = typeof body.kind === "string" ? body.kind.trim() : "";
  if (!kind) return Response.json({ ok: false }, { status: 400 });
  await recordGesture(id, userId, kind, body.data ?? {});
  return Response.json({ ok: true });
}
